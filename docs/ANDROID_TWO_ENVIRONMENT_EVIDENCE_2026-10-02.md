# Grasshopper Android Two-Environment Evidence 2026-10-02

## Workers

Two dedicated AWS Android workers are running separately from the OCI Grasshopper controller workstation.

- Companion worker: AWS instance i-0d75ebb9d822e73a7
- Development worker: AWS instance i-0224bab81a51711ce

Both run Android 15 x86_64 with KVM acceleration.

## Companion acceptance

PASS:

- SDK 35
- UID 2000
- ro.debuggable=0
- ro.secure=1
- SELinux Enforcing
- 1080x2408 screenshot
- UI automation XML PASS
- persistent marker survived emulator service restart

The companion image uses a Google APIs Play Store image and is intentionally non-root.

## Development acceptance

PASS:

- SDK 35
- UID 0 after verifier recovery
- ro.debuggable=1
- ro.secure=1
- SELinux Enforcing
- Android userdebug/test-keys fingerprint
- 1080x2408 screenshot
- UI automation XML PASS
- persistent marker survived emulator service restart

The dev emulator returns to UID 2000 after a fresh boot because userdebug adbd starts non-root. The acceptance verifier explicitly requests adb root, reconnects the transport, and then requires UID 0. This is the intended development behavior.

## Lifecycle repair

The first restart drill exposed an emulator shutdown defect. systemd SIGTERM could cause the Android Emulator to abort instead of stopping cleanly.

The worker service contract was changed to:

- use the dedicated ADB server on port 5038 for emulator shutdown;
- execute adb emu kill through the emulator-specific transport;
- retain a bounded 60-second stop timeout;
- use KillMode=mixed.

Both workers subsequently completed clean service restart and the persistence gate passed.

## UI automation limitation

The UiAutomation bridge has intermittently returned a null root during early post-boot windows. The verifier records this as NOT_PROVEN rather than treating a PID or running process as UI proof. The final restart acceptance completed with UI XML PASS for both environments.

## Evidence classification

This proves the two-environment Android worker baseline and persistence/recovery gate. It does not yet prove Samsung firmware/app-private-data cloning, physical-camera redirection, phone/SIM integration, the native one-app phone interface, or production public streaming.

Those are later layers above this worker contract.
