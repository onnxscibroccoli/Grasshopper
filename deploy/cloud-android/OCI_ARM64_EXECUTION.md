# OCI ARM64 Cloud Android execution

This is the new Cloud Android execution path for the OCI Always Free Ampere workstation.

## Why this path exists

The workstation is ARM64. The previous Cloud Android path translated x86 Android through QEMU TCG. That introduced a second architecture boundary before Android graphics and system services even started.

This path runs an ARM64 Android guest on the ARM64 OCI host. It still uses free software and does not require OCI GPU allocation or a paid accelerator.

## Runtime

- Host: OCI Ampere ARM64 Grasshopper workstation.
- Guest: LineageOS 23.2 / Android 16, ARM64-only.
- Emulator: `qemu-system-aarch64`.
- Acceleration: TCG because this OCI A1 host does not expose `/dev/kvm`.
- Default guest profile: 1536 MiB RAM, 2 vCPU.
- Graphics: QEMU `virtio-gpu-pci`, VNC framebuffer.
- Input: USB keyboard and tablet.
- Network: QEMU user networking with host port forwarding.
- ADB: guest TCP/5555 exposed on the local workstation.
- Browser screen transport: websockify + noVNC with a per-session token.
- Persistence: the extracted UTM disks remain in the state directory.

The pinned upstream UTM archive is a full Android `user` build. Upstream's release build creates a `userdebug` recovery image separately, then selects `user` before producing the UTM VM archive and OTA package. The recovery image is not a full automation VM profile.

The upstream `jqssun/android-lineage-qemu` project explicitly recommends the `arm64only` build for ARM64 Linux and documents QEMU execution with virtio-gpu and TCG when hardware acceleration is unavailable.

## Boot reliability

The launcher uses a clean 64 MiB UEFI variable store so stale or cross-architecture boot entries cannot redirect an AArch64 VM into an x64 EFI payload. The native ARM64 `vda.qcow2` disk is boot index 0 and `vdb.qcow2` is boot index 1. The guest disks remain persistent; firmware variables are disposable runtime state.

This deliberately prefers the ARM64 removable-media fallback path over persisted boot entries. The upstream image's ARM64 bootloader is therefore selected by the AArch64 firmware without inheriting stale NVRAM state.

## State boundaries

The ARM64 state is disposable until Stage 1 acceptance. The known-good legacy OCI x86/TGC state is never modified by this launcher.

The AWS Helix Kali VM is independent and remains untouched.

## Acceptance boundary

Before preparation or launch, `arm64-device.sh` applies a fail-closed image-profile admission check. The pinned `user` archive is admitted only when `CLOUD_ANDROID_ARM64_ALLOW_SETUP_GATED=1` explicitly selects interactive provisioning. That override does not prove normal-shell ADB: Setup Wizard must complete and ADB must be explicitly enabled and authorized. Unattended normal-shell automation instead requires a provenance-pinned full `userdebug` VM artifact and fresh acceptance evidence.

The full-userdebug build contract is defined separately in `environments/cloud-android-arm64-userdebug-build.json`. Its verifier binds a candidate full VM to the upstream source commit and build-script blob, both qcow2 disks, the archive digest/size, and a digest-bound `build.prop` proving the `userdebug` and ARM64 properties. The manifest template is `deploy/cloud-android/arm64-userdebug-provenance.template.json`. Until that manifest verifies against actual build artifacts, the userdebug execution path remains `NOT_PROVEN` and must not be passed to the launcher.

The launcher is considered transport-ready only when all of these are proven live:

1. QEMU process remains running.
2. VNC RFB negotiation succeeds.
3. A non-empty framebuffer is captured from the live guest.
4. ADB reaches the Android guest.
5. `sys.boot_completed=1` is observed.
6. A real Android screenshot is captured through ADB or the live framebuffer.
7. A workstation input event is acknowledged by the guest.

Only then should the bidirectional control state advance beyond Stage 1.
