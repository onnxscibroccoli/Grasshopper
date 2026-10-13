# Broccoli secure human-interaction gateway — v0.2 development handoff

**2026-10-13** · Status **IMPLEMENTATION ARTIFACT TESTED LOCALLY; not installed on production and not yet fully merged into GitHub**. Source archive `Broccoli_Secure_Handoff_Gateway_v0.2_2026-10-13.zip` is attached to the ChatGPT conversation for this development session; this document must not be mistaken for a deployed service.

## What was built

The 19-file archive contains `worker-network/gateway/`, a Python aiohttp/cryptography service with a private SQLite data store, tests, and `worker-network/android-companion/`, a Kotlin/Gradle Android companion source module, plus a proposed **manual/PR-only** Linux GitHub Actions security test workflow.

1. **Owner-paired strong biometric proof:** A one-time 256-bit pairing code issued in an authorized private Grasshopper terminal enrolls a P-256 Android Keystore public key. Android signs request-specific 60-second challenges with `BIOMETRIC_STRONG` via `BiometricPrompt.CryptoObject`. The gateway independently verifies ECDSA-SHA256 signatures and atomically consumes challenges to prevent replay. The private key never leaves the phone.
2. **Protected remote viewing design:** After valid challenge, a one-time, 60-second grant is redeemed via **POST body**, never a URL. A five-minute Secure/HttpOnly/SameSite=Strict viewer cookie is then bound to the exact handoff ticket and device. The aiohttp HTTP/WebSocket proxy checks host, exact origin, TLS-ingress marker plus shared trusted-proxy secret, ticket validity, allowed noVNC paths, cookie, challenge revocation, and idle/active WebSocket expiry. Targets **only existing local** `127.0.0.1:6080`; server binds **127.0.0.1:18791**. No production nginx/noVNC or RustDesk configuration changed.
3. **Android notification work:** FirebaseMessagingService receiver accepts *only opaque action IDs*, shows a local Android notification (`POST_NOTIFICATIONS` permission) and opens the companion. It requests biometrics before any viewer connection. FCM registration requires another device-bound signature, then stores the FCM token encrypted at rest with a locally generated mode-0600 key. The opt-in FCM sender sends only ticket ID, deduplicates by device/ticket, and **defaults to dry-run**. Firebase Spark project/FCM service authorization must be configured explicitly; no credentials or billing were touched.
4. **Independent website verification boundary:** A read-only verifier executes reviewed Google CLI / GitHub API probes, checks account principal, and explicitly returns `website_session_verified=false`. This is **not** proof that a browser inside VNC is logged in. ChatGPT and unknown third-party sites remain `UNSUPPORTED` until first-party/supported per-site session verification adapters exist. Clicking “done” remains only `AWAITING_VERIFICATION`, not `AUTH_VERIFIED`.
5. **Durability and consent:** Uses existing `worker-network/handoffctl.py` as authoritative non-secret handoff queue. No card/password/token capture, browser cookie export, cloud create/delete, pay-as-you-go activation or public Actions sign-in workers.

## Local evidence

```text
cd worker-network/gateway
PYTHONPATH=tests python3 -m unittest discover -s tests -q
Ran 19 tests in ~2.1 seconds — OK
```

Tests include pairing-code one-use, revoked key and viewer session, challenge forgery and replay rejection, ticket binding, 0600 storage and Fernet-encrypted FCM registration tokens, deduplicated dry-run notifications, positive and negative protected HTTPS proxy mock, **authorized binary WebSocket round-trip**, midstream revocation closing the socket, and no false browser-login verification. Actual Firebase delivery, public TLS ingress, Android build/install, on-phone fingerprint/face test, real noVNC remote-connection acceptance and per-site login verification have NOT been tested.

The archive contains a proposed `.github/workflows/broccoli-handoff-gateway-tests.yml`, but its workflow has NOT been added to the live default branch at the time of this entry.

## Repository adoption (not yet executed)

1. Download archive from the session. On a trusted development machine, unzip to a **new working directory**, NOT into live production home/repository with uncommitted changes.
2. Review `worker-network/gateway/README.md`, `nginx-SAMPLE.conf`, and Android `README.md`. Verify that only expected paths and no credentials are included.
3. Create a review branch based on current main; copy/merge the `worker-network/` and `.github/workflows/` paths **without overwriting existing** handoffctl files. Run isolated Python unit tests and diff review. Only then commit/PR to Grasshopper and enable test workflow.
4. Do not deploy a public TLS/noVNC gateway until the Android device can reach and validate a real HTTPS hostname and the old HTTP noVNC entry is appropriately fenced; the earlier proposed nip.io URL was *not* reachable from the phone. Existing VNC/RustDesk must be preserved for recovery.
5. The Android APK has **not yet been compiled**; Kotlin source requires a reviewed Android SDK/Gradle environment and opt-in Firebase `google-services.json`. Android biometrics must be tested on SM-A146U or equivalent hardware. No new OCI/GCP instance or paid service is necessary for local prototype testing.

## Explicit human inputs needed for a secure public proof

- A DNS hostname that resolves from the physical Android and a trusted HTTPS certificate (or a clearly authorized existing TLS endpoint). No self-signed WSS/noVNC during password entry.
- Approval to pair the Android companion in a **trusted** local session with the one-use pairing code; the user physically completes the biometric.
- Optional: a user-created Firebase **Spark** project with verified no-charge FCM and an authorized narrowly scoped sender; do not enable billing on current Google projects. FCM is officially no-cost but Firebase setup still requires the account owner.
- A first target website and an explicitly approved login-verification method; API CLI authorization is not proof of the browser's website session.

## Acceptance gates before production

`GATEWAY_TLS_PHONE_PASS`, `ANDROID_APK_BUILT`, `ANDROID_BIOMETRIC_REAL_PASS`, `NO_VNC_PROXY_AUTH_PASS`, `NO_VNC_WS_AUTH_PASS`, `REVOKE_PASS`, `FCM_DELIVERED_AND_DEDUPED`, `WEBSITE_ACCOUNT_SESSION_VERIFIED`, `RESUME_IDEMPOTENT` and `NO_BILLABLE_CHANGES`.

**None of these end-to-end production flags is claimed passed.** Only offline cryptographic, API simulation, and WebSocket proxy tests passed. Zero new cloud resources or model usage were initiated.

Official references: Android strong biometric https://developer.android.com/identity/sign-in/biometric-auth ; FCM HTTP v1 https://firebase.google.com/docs/cloud-messaging/send/v1-api ; OWASP WebSocket https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html ; noVNC/nginx https://github.com/novnc/noVNC/wiki/Proxying-with-nginx .
