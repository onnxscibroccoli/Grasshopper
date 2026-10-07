# Cloud Android OCI admission and substrate evidence — 2026-10-07

## Target

The persistent Android-worker enforcement environment remains the OCI `grasshopper-workstation`. This validation does not authorize or select AWS as an Android execution substrate.

## Host identity and capacity

Observed on the live OCI workstation:

- shape: `VM.Standard.A1.Flex`
- architecture: `aarch64`
- kernel: Oracle UEK 6.12
- host RAM: 10,898 MiB
- swap: 4,095 MiB
- dedicated Grasshopper volume: `/srv/grasshopper`, 114 GB class, approximately 108 GB free at observation time
- root filesystem: 30 GB class and intentionally not used as the preferred large Android artifact store

## Admission evidence

The new fail-closed admission gate was run for a 1,024 MiB Android guest and returned PASS.

Observed values:

- MemAvailable: 6,886 MiB
- SwapFree: 2,957 MiB
- existing QEMU RSS: 0 MiB
- existing QEMU count: 0
- requested guest: 1,024 MiB
- launch overhead allowance: 512 MiB
- protected host reserve: 2,048 MiB
- required MemAvailable: 3,584 MiB
- projected QEMU envelope: 1,536 MiB
- maximum QEMU envelope after reserve: 8,850 MiB

Machine-readable evidence is written outside the checkout under:

`~/.grasshopper/audit/cloud-android/admission/`

The launch script now invokes this gate before creating a new Android QEMU process. An already-running primary worker is not killed or restarted merely to re-run admission.

## OCI Android substrate boundary

The historical Android-x86 KVM implementation is not directly runnable on this OCI host:

- `/dev/kvm` is absent;
- `qemu-system-x86_64` is absent;
- host architecture is ARM64.

The host does have several prerequisites for a container-native Android substrate:

- page size is 4096 bytes;
- Podman is installed;
- DMA-BUF heaps are enabled.

The current kernel does **not** provide Android Binder IPC/BinderFS:

- `CONFIG_ANDROID_BINDER_IPC` is disabled;
- no Binder filesystem is registered;
- no `binder_linux` module is currently installed.

Therefore the next OCI-native Cloud Android step is to add Binder support reproducibly and validate an ARM64 container substrate such as ReDroid. No Cloud Android runtime should be called ready until Binder, local-only ADB, persistent `/data`, framebuffer transport, input, reconnect, and restart persistence all pass end to end.

## Safety rule

ADB must remain host-loopback-only. The permanent user screen path must terminate behind the authenticated HTTPS boundary. A process, port, or container state alone is not readiness evidence.
