import test from "node:test";
import assert from "node:assert/strict";

import { detectHumanBoundary } from "../src/application/human-boundary.mjs";
import {
  AUTH_GATE_EVENTS,
  applyAuthGateEvent,
  authGateDisposition,
  createAuthGate,
  createAuthGateRelayView,
  createAuthGateResumeEvent,
} from "../src/application/auth-gate.mjs";

function captchaBoundary() {
  return detectHumanBoundary({
    url: "https://example.test/login",
    title: "Verification",
    text: "Verify you are human with hCaptcha",
  });
}

test("auth gate pauses automation and relay excludes internal references", () => {
  const gate = createAuthGate(captchaBoundary(), {
    taskId: "task-1",
    sessionRef: "browser:context-7",
    provider: "generic-web",
    checkpointRef: "checkpoint:task-1/step-3",
  });

  assert.equal(gate.state, "DETECTED");
  assert.equal(authGateDisposition(gate), "PAUSE");

  const relay = createAuthGateRelayView(gate);
  assert.equal(relay.reason, "CAPTCHA_REQUIRED");
  assert.equal(relay.requiresUserPresence, true);
  assert.equal("sessionRef" in relay, false);
  assert.equal("credentialRef" in relay, false);
  assert.equal("checkpointRef" in relay, false);
});

test("auth gate resumes only after verification from the original session", () => {
  let gate = createAuthGate(captchaBoundary(), {
    taskId: "task-2",
    sessionRef: "browser:context-9",
    provider: "generic-web",
  });

  gate = applyAuthGateEvent(gate, { type: AUTH_GATE_EVENTS.USER_NOTIFIED });
  gate = applyAuthGateEvent(gate, { type: AUTH_GATE_EVENTS.USER_COMPLETED });
  assert.equal(gate.state, "VERIFYING");
  assert.equal(gate.verificationAttempts, 1);

  assert.throws(
    () => applyAuthGateEvent(gate, {
      type: AUTH_GATE_EVENTS.VERIFIED,
      verified: true,
      sessionRef: "browser:different-context",
    }),
    /original session/,
  );

  gate = applyAuthGateEvent(gate, {
    type: AUTH_GATE_EVENTS.VERIFIED,
    verified: true,
    sessionRef: "browser:context-9",
    credentialRef: "vault:provider/account-1",
  });

  assert.equal(gate.state, "RESUMED");
  assert.equal(authGateDisposition(gate), "RESUME");

  const resume = createAuthGateResumeEvent(gate);
  assert.equal(resume.type, "human.boundary.cleared");
  assert.equal(resume.sessionRef, "browser:context-9");
  assert.equal(resume.credentialRef, "vault:provider/account-1");
});

test("auth gate rejects secret-bearing event fields and non-reference credential handles", () => {
  let gate = createAuthGate(captchaBoundary(), {
    sessionRef: "browser:context-11",
  });
  gate = applyAuthGateEvent(gate, { type: AUTH_GATE_EVENTS.USER_NOTIFIED });
  gate = applyAuthGateEvent(gate, { type: AUTH_GATE_EVENTS.USER_COMPLETED });

  assert.throws(
    () => applyAuthGateEvent(gate, {
      type: AUTH_GATE_EVENTS.VERIFIED,
      verified: true,
      sessionRef: "browser:context-11",
      password: "not-accepted",
    }),
    /prohibited secret material/,
  );

  assert.throws(
    () => applyAuthGateEvent(gate, {
      type: AUTH_GATE_EVENTS.VERIFIED,
      verified: true,
      sessionRef: "browser:context-11",
      credentialRef: "opaque-without-scheme",
    }),
    /opaque namespaced reference/,
  );
});

test("verified completion is idempotent and conflicting duplicates fail closed", () => {
  let gate = createAuthGate(captchaBoundary(), {
    sessionRef: "browser:context-12",
  });
  gate = applyAuthGateEvent(gate, { type: AUTH_GATE_EVENTS.USER_NOTIFIED });
  gate = applyAuthGateEvent(gate, { type: AUTH_GATE_EVENTS.USER_COMPLETED });
  gate = applyAuthGateEvent(gate, {
    type: AUTH_GATE_EVENTS.VERIFIED,
    verified: true,
    sessionRef: "browser:context-12",
    credentialRef: "vault:provider/account-2",
  });

  assert.equal(
    applyAuthGateEvent(gate, {
      type: AUTH_GATE_EVENTS.VERIFIED,
      verified: true,
      sessionRef: "browser:context-12",
      credentialRef: "vault:provider/account-2",
    }),
    gate,
  );

  assert.throws(
    () => applyAuthGateEvent(gate, {
      type: AUTH_GATE_EVENTS.VERIFIED,
      verified: true,
      sessionRef: "browser:context-12",
      credentialRef: "vault:provider/other-account",
    }),
    /conflicting duplicate/,
  );
});

test("failed cancelled and expired gates never resume the task", () => {
  let failed = createAuthGate(captchaBoundary(), { sessionRef: "browser:failed" });
  failed = applyAuthGateEvent(failed, { type: AUTH_GATE_EVENTS.USER_NOTIFIED });
  failed = applyAuthGateEvent(failed, { type: AUTH_GATE_EVENTS.USER_COMPLETED });
  failed = applyAuthGateEvent(failed, {
    type: AUTH_GATE_EVENTS.VERIFICATION_FAILED,
    retryable: false,
  });
  assert.equal(failed.state, "FAILED");
  assert.equal(authGateDisposition(failed), "HALT");
  assert.throws(() => createAuthGateResumeEvent(failed), /not been verified/);

  let cancelled = createAuthGate(captchaBoundary(), { sessionRef: "browser:cancelled" });
  cancelled = applyAuthGateEvent(cancelled, { type: AUTH_GATE_EVENTS.CANCELLED });
  assert.equal(cancelled.state, "CANCELLED");
  assert.equal(authGateDisposition(cancelled), "HALT");

  let expired = createAuthGate(captchaBoundary(), { sessionRef: "browser:expired" });
  expired = applyAuthGateEvent(expired, { type: AUTH_GATE_EVENTS.EXPIRED });
  assert.equal(expired.state, "EXPIRED");
  assert.equal(authGateDisposition(expired), "HALT");
});

test("OAuth authorization boundaries can use device handoff mode", () => {
  const boundary = detectHumanBoundary({
    text: "Authorize this device to continue",
  });
  assert.equal(boundary?.reason, "OAUTH_AUTHORIZATION_REQUIRED");

  const gate = createAuthGate(boundary, {
    sessionRef: "oauth:session-1",
    provider: "google",
    mode: "OAUTH_DEVICE",
  });

  const relay = createAuthGateRelayView(gate);
  assert.equal(relay.mode, "OAUTH_DEVICE");
  assert.match(relay.message, /trusted provider authorization surface/);
});
