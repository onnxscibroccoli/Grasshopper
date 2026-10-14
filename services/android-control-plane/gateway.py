"""Mutual-TLS gRPC edge gateway and OAuth2-protected diagnostic job API.

Only the bounded Rish transport probe is dispatchable. All job state and result proofs are
persisted in PostgreSQL before acknowledgements are sent. No shell command is accepted.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import signal
import ssl
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import asyncpg
import grpc
import jwt
from aiohttp import web
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.x509.oid import ExtensionOID
from jwt import PyJWKClient
import control_pb2
import control_pb2_grpc

LOG = logging.getLogger("omnikali.android-control-plane")
DEVICE_URI_PREFIX = "spiffe://omnikali/device/"
OP_RISH_PROBE = "android.rish.transport.probe"
SCOPE_RISH_PROBE = "android.rish.probe"
MAX_RESULT_BYTES = 4096
MAX_QUEUE_DEPTH = 256
ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
SHA_RE = re.compile(r"^[a-f0-9]{64}$")
TARGET_MARKER_RE = re.compile(r"^RDC_RISH_TARGET_OK_[a-f0-9]{16}$")
TERMUX_RESULT_OK = -1
STOP = None


def env_required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Required environment variable {name} is unset")
    return value


def decode_certificate(value: bytes) -> x509.Certificate:
    if b"-----BEGIN CERTIFICATE-----" in value:
        return x509.load_pem_x509_certificate(value)
    return x509.load_der_x509_certificate(value)


def certificate_identity_and_sha256(certificate: x509.Certificate) -> tuple[str, str]:
    try:
        sans = certificate.extensions.get_extension_for_oid(
            ExtensionOID.SUBJECT_ALTERNATIVE_NAME
        ).value
        uris = sans.get_values_for_type(x509.UniformResourceIdentifier)
    except x509.ExtensionNotFound as exc:
        raise ValueError("Client certificate has no URI subject alternative name") from exc
    identities = [
        uri for uri in uris
        if uri.startswith(DEVICE_URI_PREFIX)
        or uri.startswith("spiffe://omnikali/gateway/")
    ]
    if len(identities) != 1:
        raise ValueError("Client certificate must have exactly one OmniKali URI identity")
    return identities[0], certificate.fingerprint(hashes.SHA256()).hex()



def validate_result_payload(payload: bytes, reported_state: str, reported_sha256: str) -> tuple[bool, str, dict[str, Any] | None]:
    """Validate bounded client evidence before a DB transaction acknowledges it."""
    if len(payload) > MAX_RESULT_BYTES:
        return False, "Result payload exceeds the protocol limit", None
    if not SHA_RE.fullmatch(reported_sha256):
        return False, "Result SHA-256 format is invalid", None
    digest = hashlib.sha256(payload).hexdigest()
    if not hmac.compare_digest(digest, reported_sha256):
        return False, "Result SHA-256 does not match the received payload", None
    try:
        evidence = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return False, "Result payload is not valid UTF-8 JSON", None
    if not isinstance(evidence, dict):
        return False, "Result evidence must be a JSON object", None

    status = evidence.get("status")
    if status == "NOT_PROVEN" and reported_state == "NOT_PROVEN":
        return True, "Evidence is explicitly not proven", evidence
    if status != "PASS" or reported_state != "PROOF_VERIFIED":
        return False, "Result state does not match its evidence payload", None

    if evidence.get("termuxInternalError") != TERMUX_RESULT_OK:
        return False, "Termux internal result status was not success", None
    if evidence.get("exitCode") != 0:
        return False, "Canonical Rish probe exit code was not zero", None
    if not all(
        isinstance(evidence.get(key), str) and SHA_RE.fullmatch(evidence[key])
        for key in ("stdoutSha256", "stderrSha256")
    ):
        return False, "Output digest evidence is missing or malformed", None
    marker = evidence.get("targetMarker")
    if not isinstance(marker, str) or not TARGET_MARKER_RE.fullmatch(marker):
        return False, "Rish target nonce marker is invalid", None
    artifact = evidence.get("artifactPath")
    if (
        not isinstance(artifact, str)
        or not (artifact.startswith("/sdcard/") or artifact.startswith("/storage/emulated/0/"))
        or ".." in Path(artifact).parts
        or len(artifact) > 512
    ):
        return False, "Shared-storage artifact path is invalid", None
    sdk = evidence.get("androidSdk")
    if not isinstance(sdk, int) or isinstance(sdk, bool) or not 26 <= sdk <= 99:
        return False, "Android SDK evidence is invalid", None
    return True, "Rish identity and proof metadata validated", evidence


def peer_certificate_from_auth_context(context: grpc.aio.ServicerContext) -> x509.Certificate:
    auth = context.auth_context()
    candidates = auth.get("x509_pem_cert", []) or auth.get("x509_pem_cert_chain", [])
    for candidate in candidates:
        try:
            return decode_certificate(bytes(candidate))
        except Exception:
            continue
    raise ValueError("gRPC TLS stack did not expose the authenticated client certificate")


@dataclass
class ConnectedSession:
    device_id: str
    session_id: str
    outgoing: asyncio.Queue
    server_sequence: int = 0
    ready: bool = True
    last_heartbeat_sent: float = field(default_factory=time.monotonic)

    async def send(self, field_name: str, payload: Any) -> None:
        self.server_sequence += 1
        message = control_pb2.ServerMessage(sequence=self.server_sequence)
        getattr(message, field_name).CopyFrom(payload)
        await self.outgoing.put(message)


class ControlPlaneService(control_pb2_grpc.ControlPlaneServicer):
    def __init__(self, pool: asyncpg.Pool):
        self.pool = pool
        self.sessions: dict[str, ConnectedSession] = {}

    async def Connect(self, request_iterator, context):
        outgoing: asyncio.Queue = asyncio.Queue(maxsize=MAX_QUEUE_DEPTH)
        state: dict[str, Any] = {}
        consumer = asyncio.create_task(
            self._consume(request_iterator, context, outgoing, state),
            name="android-grpc-consumer",
        )
        dispatcher = asyncio.create_task(
            self._dispatch_loop(context, outgoing, state),
            name="android-grpc-dispatcher",
        )
        try:
            while True:
                message = await outgoing.get()
                if message is STOP:
                    break
                yield message
        finally:
            consumer.cancel()
            dispatcher.cancel()
            await asyncio.gather(consumer, dispatcher, return_exceptions=True)
            session = state.get("session")
            if session is not None:
                session.ready = False
                if self.sessions.get(session.device_id) is session:
                    self.sessions.pop(session.device_id, None)
                await self._mark_indeterminate(session)
                await self._audit(
                    "device_disconnected", device_id=session.device_id,
                    details={"session_id": session.session_id},
                )

    async def _consume(self, request_iterator, context, outgoing, state):
        session: ConnectedSession | None = None
        last_sequence = 0
        try:
            async for message in request_iterator:
                if message.sequence <= last_sequence:
                    await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Non-monotonic client sequence")
                last_sequence = message.sequence
                kind = message.WhichOneof("payload")

                if session is None:
                    if kind != "hello":
                        await context.abort(grpc.StatusCode.UNAUTHENTICATED, "First stream message must be Hello")
                    try:
                        certificate = peer_certificate_from_auth_context(context)
                        identity, fingerprint = certificate_identity_and_sha256(certificate)
                    except Exception as exc:
                        LOG.warning("gRPC peer identity could not be read: %s", type(exc).__name__)
                        await context.abort(grpc.StatusCode.UNAUTHENTICATED, "Authenticated device identity is unavailable")
                    if not identity.startswith(DEVICE_URI_PREFIX):
                        await context.abort(grpc.StatusCode.PERMISSION_DENIED, "Gateway certificates cannot be used as device certificates")
                    device_id = identity[len(DEVICE_URI_PREFIX):]
                    if not ID_RE.fullmatch(device_id):
                        await context.abort(grpc.StatusCode.PERMISSION_DENIED, "Invalid device URI identity")
                    if message.device_id != device_id:
                        await context.abort(grpc.StatusCode.PERMISSION_DENIED, "Message device_id does not match certificate identity")

                    async with self.pool.acquire() as connection:
                        device = await connection.fetchrow(
                            """
                            SELECT device_id, certificate_uri, certificate_sha256, scopes, enabled
                            FROM controller_devices
                            WHERE device_id = $1 AND certificate_uri = $2
                              AND certificate_sha256 = $3 AND enabled = true
                            """,
                            device_id, identity, fingerprint,
                        )
                    if device is None:
                        await context.abort(grpc.StatusCode.UNAUTHENTICATED, "Device certificate is not enrolled or has been revoked")
                    if SCOPE_RISH_PROBE not in device["scopes"]:
                        await context.abort(grpc.StatusCode.PERMISSION_DENIED, "Device lacks diagnostic scope")

                    session = ConnectedSession(
                        device_id=device_id,
                        session_id=message.session_id or str(uuid.uuid4()),
                        outgoing=outgoing,
                    )
                    state["session"] = session
                    previous = self.sessions.get(device_id)
                    if previous is not None:
                        previous.ready = False
                        try:
                            previous.outgoing.put_nowait(STOP)
                        except asyncio.QueueFull:
                            pass
                    self.sessions[device_id] = session
                    async with self.pool.acquire() as connection:
                        await connection.execute(
                            """
                            UPDATE controller_devices
                            SET last_seen_at = now(), last_session_id = $2,
                                last_execution_state = 'CONNECTED', updated_at = now()
                            WHERE device_id = $1
                            """,
                            device_id, session.session_id,
                        )
                    await self._audit(
                        "device_connected", device_id=device_id,
                        details={"session_id": session.session_id, "app_version": message.hello.app_version,
                                  "protocol_version": message.hello.protocol_version},
                    )
                    await session.send("welcome", control_pb2.Welcome(
                        server_version="android-control-plane/1",
                        heartbeat_interval_seconds=20,
                    ))
                    continue

                if kind == "hello":
                    await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Hello may only be sent once per session")
                if message.device_id != session.device_id:
                    await context.abort(grpc.StatusCode.PERMISSION_DENIED, "Device identity changed inside the stream")

                if kind == "heartbeat":
                    async with self.pool.acquire() as connection:
                        await connection.execute(
                            """
                            UPDATE controller_devices
                            SET last_seen_at = now(), last_execution_state = $2, updated_at = now()
                            WHERE device_id = $1 AND last_session_id = $3
                            """,
                            session.device_id, message.heartbeat.execution_state[:128], session.session_id,
                        )
                elif kind == "accepted":
                    await self._record_acceptance(session, message.accepted)
                elif kind == "result":
                    await self._record_result(session, message.result)
                elif kind == "failure":
                    await self._record_failure(session, message.failure)
                else:
                    await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Unsupported client message payload")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if not context.done():
                LOG.warning("gRPC stream ended (%s)", type(exc).__name__)
        finally:
            if session is not None:
                session.ready = False
                if self.sessions.get(session.device_id) is session:
                    self.sessions.pop(session.device_id, None)
                await self._mark_indeterminate(session)
            try:
                outgoing.put_nowait(STOP)
            except asyncio.QueueFull:
                pass

    async def _dispatch_loop(self, context, outgoing, state):
        last_heartbeat = time.monotonic()
        try:
            while not context.done():
                session: ConnectedSession | None = state.get("session")
                if session is None or not session.ready:
                    await asyncio.sleep(0.25)
                    continue

                async with self.pool.acquire() as connection:
                    async with connection.transaction():
                        expired = await connection.fetch(
                            """
                            UPDATE controller_jobs
                            SET state = 'failed', last_error_code = 'DEADLINE_EXPIRED',
                                result_detail = 'Expired before dispatch', finished_at = now(), updated_at = now()
                            WHERE device_id = $1 AND state = 'queued' AND deadline_at <= now()
                            RETURNING job_id
                            """,
                            session.device_id,
                        )
                        row = await connection.fetchrow(
                            """
                            SELECT job_id, idempotency_key, operation, required_scope, payload, deadline_at
                            FROM controller_jobs
                            WHERE device_id = $1 AND state = 'queued' AND deadline_at > now()
                            ORDER BY created_at
                            FOR UPDATE SKIP LOCKED
                            LIMIT 1
                            FOR UPDATE SKIP LOCKED
                            """,
                            session.device_id,
                        )
                        if row is not None:
                            await connection.execute(
                                """
                                UPDATE controller_jobs
                                SET state = 'offered', lease_session_id = $2,
                                    offered_at = now(), updated_at = now()
                                WHERE job_id = $1 AND state = 'queued'
                                """,
                                row["job_id"], session.session_id,
                            )
                for expired_row in expired:
                    await self._audit(
                        "job_deadline_expired", device_id=session.device_id,
                        job_id=expired_row["job_id"],
                    )
                if row is not None:
                    await session.send("command", control_pb2.JobCommand(
                        job_id=row["job_id"],
                        idempotency_key=row["idempotency_key"],
                        operation=row["operation"],
                        payload=bytes(row["payload"]),
                        deadline_unix_ms=int(row["deadline_at"].timestamp() * 1000),
                        required_scope=row["required_scope"],
                    ))
                if time.monotonic() - last_heartbeat >= 25:
                    await session.send("heartbeat", control_pb2.ServerHeartbeat(
                        timestamp_unix_ms=int(time.time() * 1000),
                    ))
                    last_heartbeat = time.monotonic()
                await asyncio.sleep(0.25)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            LOG.warning("Dispatch loop ended (%s)", type(exc).__name__)
            try:
                outgoing.put_nowait(STOP)
            except asyncio.QueueFull:
                pass

    async def _record_acceptance(self, session: ConnectedSession, accepted) -> None:
        if not ID_RE.fullmatch(accepted.job_id):
            return
        if accepted.state != "DISPATCHED_AWAITING_PROOF":
            await self._audit(
                "invalid_job_acceptance", device_id=session.device_id,
                job_id=accepted.job_id, details={"reported_state": accepted.state[:64]},
            )
            return
        async with self.pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                UPDATE controller_jobs
                SET state = 'accepted', accepted_at = now(), updated_at = now()
                WHERE job_id = $1 AND device_id = $2 AND lease_session_id = $3
                  AND state IN ('offered', 'indeterminate')
                RETURNING job_id
                """,
                accepted.job_id, session.device_id, session.session_id,
            )
        if row:
            await self._audit("job_accepted", device_id=session.device_id, job_id=accepted.job_id)

    async def _record_result(self, session: ConnectedSession, result) -> None:
        job_id = result.job_id
        payload = bytes(result.payload)
        digest = hashlib.sha256(payload).hexdigest()
        ok = False
        server_state = "unknown"
        detail = "Result rejected"
        if ID_RE.fullmatch(job_id):
            valid_evidence, evidence_detail, evidence = validate_result_payload(
                payload, result.state, result.sha256
            )
            if not valid_evidence:
                detail = evidence_detail
            else:
                reported_status = evidence["status"]
                async with self.pool.acquire() as connection:
                        async with connection.transaction():
                            job = await connection.fetchrow(
                                """
                                SELECT job_id, state, result_sha256
                                FROM controller_jobs
                                WHERE job_id = $1 AND device_id = $2
                                FOR UPDATE
                                """,
                                job_id, session.device_id,
                            )
                            if job is None:
                                detail = "Job is not owned by this device"
                            elif job["result_sha256"] is not None:
                                ok = hmac.compare_digest(job["result_sha256"].strip(), digest)
                                server_state = job["state"]
                                detail = "Previously persisted result acknowledged" if ok else "Conflicting duplicate result rejected"
                                if ok:
                                    await connection.execute(
                                        "UPDATE controller_jobs SET result_acknowledged = true WHERE job_id = $1",
                                        job_id,
                                    )
                            elif job["state"] not in ("offered", "accepted", "indeterminate"):
                                detail = "Job is not in a result-accepting state"
                            else:
                                server_state = "completed" if reported_status == "PASS" else "not_proven"
                                await connection.execute(
                                    """
                                    UPDATE controller_jobs
                                    SET state = $2, result_state = $3, result_payload = $4,
                                        result_sha256 = $5, result_detail = $6,
                                        result_acknowledged = true, finished_at = now(), updated_at = now()
                                    WHERE job_id = $1
                                    """,
                                    job_id, server_state, reported_status, payload, digest,
                                    "Verified proof marker accepted" if reported_status == "PASS"
                                    else str(evidence.get("reason", "Evidence is not proven"))[:1000],
                                )
                                ok = True
                                detail = "Result durably persisted"
                    if ok:
                        await self._audit(
                            "job_result_persisted", device_id=session.device_id, job_id=job_id,
                            details={"state": server_state, "sha256": digest},
                        )
            except (UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
                detail = "Result payload is not valid bounded JSON evidence"
            except Exception as exc:
                LOG.warning("Result persistence failed (%s)", type(exc).__name__)
                detail = "Temporary persistence error; client may retry"
        await session.send("result_ack", control_pb2.JobResultAck(
            job_id=job_id[:128],
            accepted=ok,
            server_state=server_state,
            detail=detail[:500],
        ))

    async def _record_failure(self, session: ConnectedSession, failure) -> None:
        if not ID_RE.fullmatch(failure.job_id):
            return
        async with self.pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                UPDATE controller_jobs
                SET state = 'failed', last_error_code = $4,
                    result_detail = $5, finished_at = now(), updated_at = now()
                WHERE job_id = $1 AND device_id = $2 AND lease_session_id = $3
                  AND state IN ('offered', 'accepted', 'indeterminate')
                RETURNING job_id
                """,
                failure.job_id, session.device_id, session.session_id,
                failure.error_code[:128], failure.message[:1000],
            )
        if row:
            await self._audit(
                "job_failed", device_id=session.device_id, job_id=failure.job_id,
                details={"error_code": failure.error_code[:128], "retryable_reported": bool(failure.retryable)},
            )

    async def _mark_indeterminate(self, session: ConnectedSession) -> None:
        try:
            async with self.pool.acquire() as connection:
                rows = await connection.fetch(
                    """
                    UPDATE controller_jobs
                    SET state = 'indeterminate',
                        result_detail = 'Connection ended after offer; side effect status is unknown and was not automatically replayed',
                        updated_at = now()
                    WHERE device_id = $1 AND lease_session_id = $2
                      AND state IN ('offered', 'accepted')
                    RETURNING job_id
                    """,
                    session.device_id, session.session_id,
                )
            for row in rows:
                await self._audit(
                    "job_indeterminate", device_id=session.device_id, job_id=row["job_id"],
                    details={"session_id": session.session_id},
                )
        except Exception as exc:
            LOG.warning("Unable to reconcile disconnected jobs (%s)", type(exc).__name__)

    async def _audit(
        self, event_type: str, *, principal_id: str | None = None,
        device_id: str | None = None, job_id: str | None = None,
        details: dict | None = None,
    ) -> None:
        try:
            async with self.pool.acquire() as connection:
                await connection.execute(
                    """
                    INSERT INTO controller_audit_events
                    (event_type, principal_id, device_id, job_id, details)
                    VALUES ($1, $2, $3, $4, $5::jsonb)
                    """,
                    event_type, principal_id, device_id, job_id,
                    json.dumps(details or {}),
                )
        except Exception as exc:
            LOG.error("Audit write failed (%s)", type(exc).__name__)


class JobApi:
    def __init__(self, pool: asyncpg.Pool, jwks_client: PyJWKClient):
        self.pool = pool
        self.jwks_client = jwks_client

    async def health(self, request: web.Request) -> web.Response:
        try:
            async with self.pool.acquire() as connection:
                await connection.execute("SELECT 1")
            return web.json_response({"status": "READY"})
        except Exception:
            return web.json_response({"status": "NOT_READY"}, status=503)

    async def create_probe(self, request: web.Request) -> web.Response:
        device_id = request.match_info["device_id"]
        if not ID_RE.fullmatch(device_id):
            return web.json_response({"error": "invalid_device_id"}, status=400)
        try:
            certificate_der = request.transport.get_extra_info("ssl_object").getpeercert(binary_form=True)
            if not certificate_der:
                return web.json_response({"error": "client_certificate_required"}, status=401)
            fingerprint = hashlib.sha256(certificate_der).hexdigest()
            client_certificate = await self._authorized_api_certificate(fingerprint)
            claims = await self._authorized_oauth_claims(request)
            if claims["sub"] != client_certificate["principal_id"]:
                return web.json_response({"error": "certificate_token_subject_mismatch"}, status=403)
            token_scopes = set(str(claims.get("scope", "")).split())
            if not isinstance(claims.get("scope", ""), str):
                token_scopes = set(claims.get("scp", []))
            if SCOPE_RISH_PROBE not in token_scopes or SCOPE_RISH_PROBE not in client_certificate["scopes"]:
                return web.json_response({"error": "insufficient_scope"}, status=403)
            if device_id not in client_certificate["allowed_devices"]:
                return web.json_response({"error": "device_not_authorized"}, status=403)
            body = await request.json()
            if not isinstance(body, dict):
                return web.json_response({"error": "json_object_required"}, status=400)
            idempotency_key = request.headers.get("Idempotency-Key", "")
            if not ID_RE.fullmatch(idempotency_key):
                return web.json_response({"error": "valid_idempotency_key_required"}, status=400)
            deadline_seconds = body.get("deadlineSeconds", 120)
            if not isinstance(deadline_seconds, int) or isinstance(deadline_seconds, bool) or not 30 <= deadline_seconds <= 600:
                return web.json_response({"error": "deadlineSeconds_must_be_30_to_600"}, status=400)

            async with self.pool.acquire() as connection:
                device = await connection.fetchrow(
                    "SELECT device_id, enabled, scopes FROM controller_devices WHERE device_id=$1",
                    device_id,
                )
                if device is None or not device["enabled"]:
                    return web.json_response({"error": "device_not_enrolled"}, status=404)
                if SCOPE_RISH_PROBE not in device["scopes"]:
                    return web.json_response({"error": "device_lacks_required_scope"}, status=403)

                job_id = "job_" + uuid.uuid4().hex
                inserted = await connection.fetchrow(
                    """
                    INSERT INTO controller_jobs
                    (job_id, idempotency_key, created_by, device_id, operation, required_scope,
                     payload, state, deadline_at)
                    VALUES ($1, $2, $3, $4, $5, $6, decode('', 'hex'), 'queued',
                            now() + ($7 * interval '1 second'))
                    ON CONFLICT (idempotency_key) DO NOTHING
                    RETURNING job_id, state, device_id, operation, deadline_at
                    """,
                    job_id, idempotency_key, claims["sub"], device_id,
                    OP_RISH_PROBE, SCOPE_RISH_PROBE, deadline_seconds,
                )
                if inserted is None:
                    existing = await connection.fetchrow(
                        """
                        SELECT job_id, state, device_id, operation, created_by, deadline_at
                        FROM controller_jobs WHERE idempotency_key=$1
                        """,
                        idempotency_key,
                    )
                    if existing is None or (
                        existing["created_by"] != claims["sub"]
                        or existing["device_id"] != device_id
                        or existing["operation"] != OP_RISH_PROBE
                    ):
                        return web.json_response({"error": "idempotency_key_conflict"}, status=409)
                    return web.json_response({
                        "jobId": existing["job_id"], "state": existing["state"],
                        "deviceId": existing["device_id"], "operation": existing["operation"],
                        "deadlineAt": existing["deadline_at"].isoformat(),
                        "idempotentReplay": True,
                    }, status=200)

                await connection.execute(
                    """
                    INSERT INTO controller_audit_events
                    (event_type, principal_id, device_id, job_id, details)
                    VALUES ('job_created', $1, $2, $3, $4::jsonb)
                    """,
                    claims["sub"], device_id, inserted["job_id"],
                    json.dumps({"operation": OP_RISH_PROBE, "deadline_seconds": deadline_seconds}),
                )
            return web.json_response({
                "jobId": inserted["job_id"], "state": inserted["state"],
                "deviceId": inserted["device_id"], "operation": inserted["operation"],
                "deadlineAt": inserted["deadline_at"].isoformat(),
                "idempotentReplay": False,
            }, status=202)
        except web.HTTPException as exc:
            return web.json_response({"error": exc.reason}, status=exc.status)
        except jwt.PyJWTError:
            return web.json_response({"error": "invalid_oauth2_access_token"}, status=401)
        except (ValueError, TypeError, KeyError):
            return web.json_response({"error": "invalid_request"}, status=400)
        except Exception as exc:
            LOG.warning("Probe API request failed (%s)", type(exc).__name__)
            return web.json_response({"error": "gateway_internal_error"}, status=500)

    async def _authorized_api_certificate(self, fingerprint: str):
        async with self.pool.acquire() as connection:
            row = await connection.fetchrow(
                """
                SELECT certificate_sha256, principal_id, scopes, allowed_devices
                FROM controller_api_clients
                WHERE certificate_sha256=$1 AND enabled=true
                """,
                fingerprint,
            )
        if row is None:
            raise web.HTTPUnauthorized(reason="API client certificate is not enrolled")
        return row

    async def _authorized_oauth_claims(self, request: web.Request) -> dict:
        authorization = request.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            raise web.HTTPUnauthorized(reason="OAuth2 bearer token required")
        token = authorization[7:].strip()
        if not token or len(token) > 16384:
            raise web.HTTPUnauthorized(reason="Invalid bearer token")
        signing_key = await asyncio.to_thread(self.jwks_client.get_signing_key_from_jwt, token)
        issuer = env_required("OIDC_ISSUER")
        audience = env_required("OIDC_AUDIENCE")
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            issuer=issuer,
            audience=audience,
            options={"require": ["exp", "iat", "sub"]},
        )
        if not isinstance(claims.get("sub"), str) or not claims["sub"]:
            raise jwt.InvalidTokenError("JWT subject is required")
        if int(claims.get("exp", 0)) <= int(time.time()):
            raise jwt.ExpiredSignatureError("JWT expired")
        return claims


async def build_api(pool: asyncpg.Pool) -> web.Application:
    jwks_url = env_required("OIDC_JWKS_URL")
    api = JobApi(pool, PyJWKClient(jwks_url, cache_keys=True, lifespan=300))
    app = web.Application(client_max_size=64 * 1024)
    app.router.add_get("/healthz", api.health)
    app.router.add_post("/v1/devices/{device_id}/jobs/rish-transport-probe", api.create_probe)
    return app


async def serve() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    database_url = env_required("DATABASE_URL")
    server_certificate = Path(env_required("TLS_CERT_PATH")).read_bytes()
    server_private_key = Path(env_required("TLS_KEY_PATH")).read_bytes()
    client_ca = Path(env_required("CLIENT_CA_PATH")).read_bytes()
    grpc_bind = os.environ.get("GRPC_BIND", "0.0.0.0:9443")
    api_bind = os.environ.get("API_BIND", "0.0.0.0")
    api_port = int(os.environ.get("API_PORT", "8443"))

    pool = await asyncpg.create_pool(
        database_url,
        min_size=1,
        max_size=int(os.environ.get("DB_POOL_MAX", "10")),
        command_timeout=10,
        timeout=10,
        server_settings={"application_name": "grasshopper-android-control-plane"},
    )
    try:
        if os.environ.get("AUTO_MIGRATE", "false").lower() in {"1", "true", "yes"}:
            schema = Path(__file__).with_name("schema.sql").read_text(encoding="utf-8")
            async with pool.acquire() as connection:
                await connection.execute(schema)

        grpc_server = grpc.aio.server(
            options=[
                ("grpc.max_receive_message_length", 64 * 1024),
                ("grpc.max_send_message_length", 64 * 1024),
                ("grpc.keepalive_time_ms", 30000),
                ("grpc.keepalive_timeout_ms", 10000),
                ("grpc.max_concurrent_streams", 256),
            ]
        )
        control_pb2_grpc.add_ControlPlaneServicer_to_server(ControlPlaneService(pool), grpc_server)
        credentials = grpc.ssl_server_credentials(
            ((server_private_key, server_certificate),),
            root_certificates=client_ca,
            require_client_auth=True,
        )
        if grpc_server.add_secure_port(grpc_bind, credentials) == 0:
            raise RuntimeError("Could not bind secure gRPC listener")
        await grpc_server.start()

        ssl_context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        ssl_context.load_cert_chain(
            certfile=env_required("TLS_CERT_PATH"),
            keyfile=env_required("TLS_KEY_PATH"),
        )
        ssl_context.load_verify_locations(cafile=env_required("CLIENT_CA_PATH"))
        ssl_context.verify_mode = ssl.CERT_REQUIRED
        ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2

        app = await build_api(pool)
        runner = web.AppRunner(app, access_log=None, shutdown_timeout=10)
        await runner.setup()
        site = web.TCPSite(runner, api_bind, api_port, ssl_context=ssl_context)
        await site.start()
        LOG.info("Control plane ready: gRPC=%s API=%s:%s (mTLS required)", grpc_bind, api_bind, api_port)

        stop_event = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop_event.set)
            except NotImplementedError:
                pass
        await stop_event.wait()
        await runner.cleanup()
        await grpc_server.stop(grace=5)
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(serve())
