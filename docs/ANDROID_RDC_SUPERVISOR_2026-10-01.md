# Android RDC supervisor

Date: 2026-10-01
Implementation: broccoli-core PR #64
Grasshopper tracking issue: #125

## Goal

Keep the Termux-hosted Desktop Commander Remote Device recoverable without requiring a manual terminal restart when the Termux process or the RDC child disappears.

## Architecture

    Android foreground supervisor
      -> explicit Termux RunCommandService intent
      -> Termux bash
      -> fixed reconciliation command
      -> existing npx @wonderwhy-er/desktop-commander@latest remote

The Android service does not expose arbitrary shell execution.

## Recovery semantics

1. Supervisor runs as a START_STICKY foreground service.
2. Boot and package-replacement receivers request supervisor startup.
3. Every 15 seconds the supervisor performs reconciliation.
4. ActivityManager process observation is best-effort only.
5. The Termux-side command creates an atomic lock.
6. It checks for an existing Desktop Commander remote process.
7. If one exists, it records ALREADY_RUNNING and exits.
8. If absent, it starts the remote device in the background and records STARTED.
9. Android-side recovery attempts are separated by at least 60 seconds.
10. Therefore both Termux death and RDC-child death are recoverable without creating an uncontrolled process storm.

## Security gates

Termux requires the third-party caller to hold com.termux.permission.RUN_COMMAND and requires allow-external-apps=true. The supervisor intentionally does not bypass either gate.

The Android service uses foreground-service type specialUse. Android 14+ requires an explicit foreground-service type and matching permission; Android 15 places boot restrictions on several other service types, while specialUse is the documented category for valid long-running cases that do not fit those categories.

## Evidence state

SOURCE_IMPLEMENTED: PASS
STATIC_DESIGN_REVIEW: PASS
GITHUB_PR: PASS, broccoli-core #64
CI_BUILD: NOT_PROVEN, no GitHub workflow run was reported for the branch
LIVE_INSTALL: NOT_PROVEN
TERMUX_CRASH_RECOVERY: NOT_PROVEN
RDC_CHILD_CRASH_RECOVERY: NOT_PROVEN
BOOT_RECOVERY: NOT_PROVEN

The live phone/RDC device became unreachable during the preceding transport investigation. That is now the exact failure case this supervisor is designed to cover, but installation and recovery cannot be claimed until the device is reachable again.

## Acceptance sequence

After device recovery:

- build debug APK
- install APK
- grant Run commands in Termux environment
- enable allow-external-apps in Termux
- start supervisor once
- verify notification and steady-state
- stop Termux
- verify supervisor causes Termux to execute the recovery command
- verify exactly one Desktop Commander remote process
- terminate RDC while leaving Termux alive
- verify reconciliation restores RDC
- reboot
- verify supervisor and RDC recover without a duplicate process
- preserve logs and timestamps as live evidence
