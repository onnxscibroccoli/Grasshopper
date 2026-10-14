# OmniKali Android Controller

This is an isolated Android edge client, not a replacement for Grasshopper's task ledger, Helix's desktop gateway, or the canonical Broccoli Rish transport.

## Current supported path

- Android UI reports the Shizuku binder and this app's own Shizuku permission separately.
- A local proof trigger starts only the fixed canonical command RISH_PRESERVE_ENV=0 bash ./lib/rish_transport_probe.sh through Termux:RunCommandService. It never accepts a remote shell string.
- The secure gRPC client requires a configured DNS/IP target and an imported PKCS#12 client identity. The PKCS#12 material is encrypted at rest with an Android Keystore AES-GCM key. The gRPC channel requires TLS and client authentication.
- The bidirectional protocol accepts only the allowlisted operation android.rish.transport.probe. Other remote operations are rejected; no OCI provisioning or arbitrary command is executed by this APK.
- A command launch is recorded as DISPATCHED_AWAITING_PROOF, never as completed. A successful service launch is not proof that the remote Rish target produced the required UID/SDK/artifact evidence.

## Build

Run scripts/build-android-controller.sh from any working directory. It downloads the pinned Gradle distribution and checks it against the distribution's published SHA-256 before running the Android build.

The project targets Android 15 / API 35, requires JDK 17, and uses Gradle 8.9 with Android Gradle Plugin 8.7.3. CI builds and tests the debug variant on pull requests. A published release requires a configured release signing keystore and an independently pinned expected signer SHA-256.

## First launch and reboot

1. Install Shizuku and start its service according to the official setup instructions. Non-root Shizuku must be manually restarted after device reboot on supported Android versions.
2. Open the controller and grant its own Shizuku permission.
3. Configure Termux external-command access and grant Termux its own Shizuku permission. Granting permission to this APK does not grant it to Termux.
4. Confirm that ~/broccoli-rish contains the canonical wrapper and live probe. Do not create a second wrapper.
5. Import the PKCS#12 client certificate provided by the authorized gateway operator, enter its password, and configure the gRPC host/port.
6. Start the visible foreground service. After reboot, open the app and re-check Shizuku, Termux, and connectivity; the boot receiver only posts a reminder and does not attempt to bypass Android startup restrictions.

## Server contract

The protocol source is app/src/main/proto/control.proto. A production server must authenticate the client certificate, map it to an enrolled device principal, authorize the requested scope independently of the device_id message field, enforce deadlines/replay protection, persist jobs before acknowledgement, and record proof separately from dispatch. The server must not infer that accepting a gRPC message means a remote side effect completed.

The APK does not provision its own certificate, create a server endpoint, or contain cloud credentials. Those are operator-controlled enrollment and deployment steps. No production deployment or signed release is claimed by source code alone.
