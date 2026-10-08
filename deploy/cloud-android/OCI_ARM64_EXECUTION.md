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

The upstream `jqssun/android-lineage-qemu` project explicitly recommends the `arm64only` build for ARM64 Linux and documents QEMU execution with virtio-gpu and TCG when hardware acceleration is unavailable.

## Boot reliability

The upstream ARM64 image currently reaches the UEFI shell when its stored boot entry is not suitable for the local firmware. The launcher therefore creates a tiny read-only FAT boot-helper disk containing `startup.nsh`. The helper is boot index 0 and launches:

```
fs1:
\EFI\BOOT\BOOTAA64.EFI
```

This avoids modifying the Android disk image just to repair firmware boot selection.

## State boundaries

The ARM64 state is disposable until Stage 1 acceptance. The known-good legacy OCI x86/TGC state is never modified by this launcher.

The AWS Helix Kali VM is independent and remains untouched.

## Acceptance boundary

The launcher is considered transport-ready only when all of these are proven live:

1. QEMU process remains running.
2. VNC RFB negotiation succeeds.
3. A non-empty framebuffer is captured from the live guest.
4. ADB reaches the Android guest.
5. `sys.boot_completed=1` is observed.
6. A real Android screenshot is captured through ADB or the live framebuffer.
7. A workstation input event is acknowledged by the guest.

Only then should the bidirectional control state advance beyond Stage 1.
