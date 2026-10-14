# Android controller acceptance contract

Status: DEV_SANDBOX implementation branch; no signed production APK or live gateway acceptance is claimed.

## Source boundaries

- Native Android controller: apps/android-controller
- Canonical Rish transport: onnxscibroccoli/broccoli-rish, lib/rish_run.sh
- Phone-side control-plane MCP and Android UI automation: Grasshopper issue/PR #115
- Durable control-plane and task lifecycle: Grasshopper canonical source
- Cloud desktop ingress: Helix; protected, out of scope for this change

The Android client does not copy or fork the Rish wrapper. It invokes only the fixed transport probe through Termux:RunCommandService. Arbitrary shell commands received over gRPC are not supported.

## Supported command today

Operation: android.rish.transport.probe
Required scope: android.rish.probe
Payload: empty
Maximum accepted command deadline: ten minutes from receipt

The client durably inserts the command identity and idempotency key before dispatch. A duplicate job or idempotency key is fenced. If the fixed Termux command launch succeeds, the state becomes DISPATCHED_AWAITING_PROOF. It is not reported as completed because the Termux service launch API does not return the canonical probe's complete stdout, target UID, SDK, or artifact proof to this APK.

All other operations are rejected. In particular, this APK cannot provision OCI resources, execute arbitrary shell, or mutate workstation services. These operations must be authorized and implemented on the server side through existing control-plane contracts.

## Local development gates

1. Run: bash scripts/build-android-controller.sh :app:testDebugUnitTest :app:assembleDebug
2. Install the debug APK on a real Android 15 / API 35 device.
3. Test Shizuku binder unavailable, permission denied, permission granted, and binder death.
4. Test Termux absent, external-command permission denied, Rish absent, runtime snapshot missing, and valid canonical probe.
5. Confirm the app does not report PASS after service dispatch unless required output and artifact are separately captured and verified.
6. Test gRPC server certificate mismatch, missing/invalid client certificate, expired client certificate, stream disconnect, retry backoff, duplicate command, expired command, invalid scope, non-empty payload, unsupported operation, and cancellation.
7. Verify Android 15 foreground-service time limits. The service is visible and does not claim to remain connected indefinitely; after OS timeout it stops and awaits operator restart.
8. Verify post-reboot reminder, then manually restart Shizuku and open the app. The app must not silently bypass Android startup policy.

## Release gates

A production release additionally requires:
- An actual mTLS gateway endpoint and certificate enrollment/revocation procedure.
- A server implementation with client-certificate-to-device mapping, provider OAuth2/mTLS identity mapping, per-operation scopes, server-side deadline and replay checks, durable task ownership, result proof ingestion and audit redaction.
- Cross-boundary integration tests against the existing Grasshopper durable task lifecycle and an approved OCI development identity.
- Protected GitHub Actions secrets: CONTROLLER_KEYSTORE_BASE64, CONTROLLER_KEYSTORE_PASSWORD, CONTROLLER_KEY_ALIAS, CONTROLLER_KEY_PASSWORD and CONTROLLER_SIGNER_SHA256.
- A published GitHub Release where apksigner verifies the final APK and the signer digest matches the independently pinned CONTROLLER_SIGNER_SHA256.
- Physical-device acceptance evidence with non-empty artifacts for each claimed pass.

Android's ordinary non-root Shizuku startup may require manual restart after reboot. The boot receiver only posts a reminder. Android 15 also limits dataSync foreground-service runtime; the controller does not promise an unlimited always-on channel.

## Release artifact convention

The release job publishes controller.apk, controller.apk.sha256, and controller-release-manifest.txt to the tagged GitHub Release only after signing verification. The download path for a real release is:

https://github.com/onnxscibroccoli/Grasshopper/releases/download/<tag>/controller.apk

Replace <tag> with the actual published tag. This URL is a convention, not a claim that a release already exists.
