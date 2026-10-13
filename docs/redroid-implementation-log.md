# Redroid Implementation Log

**Date:** 2026-10-13
**Status:** Design logged, not yet deployed. Target: OCI Always Free Ampere A1 (arm64).
**Context:** AWS credits exhausted; OmniKali workstation moved to OCI. Android emulation on OCI was failing because the Ampere A1 host does not expose /dev/kvm, so QEMU TCG software emulation was the only path — measured ~12x slowdown for aarch64 guests (Linaro). That path is abandoned for this use case.

## The Java point (why this works)

Android's app runtime is already a virtual machine. Since Android 5.0, **ART** (Android Runtime) executes DEX bytecode — the successor to Dalvik. ART compiles DEX to native code at install time (AOT via dex2oat) with JIT/profile-guided compilation on top. So Android apps do not need a second hypervisor layer to run: the runtime *is* the VM. Emulating Android does not mean emulating a whole machine; it means providing the Android userspace (kernel modules + container) and letting ART handle app execution. This is exactly what redroid does.

## What redroid is

redroid (Remote Android) — a multi-arch, GPU-enabled Android-in-Cloud solution. It runs Android as a Docker/podman/k8s container directly on the host Linux kernel using binderfs and ashmem (or memfd on newer kernels). It never touches /dev/kvm. It supports both arm64 and amd64, boots many instances per host, and exposes ADB on port 5555. Official images go up to Android 16.

## Relevant upstream repos (verified 2026-10-13)

| Repo | URL | Role |
| --- | --- | --- |
| redroid-doc | https://github.com/remote-android/redroid-doc | Main docs, deploy guides, issue tracker. 6.9k stars. |
| redroid-modules | https://github.com/remote-android/redroid-modules | Kernel modules for binderfs/ashmem. Required on hosts without the modules built in. |
| vendor_redroid | https://github.com/remote-android/vendor_redroid | Shared redroid vendor modules (gralloc, binder_alloc, etc.) |
| device_redroid | https://github.com/remote-android/device_redroid | Device config and product definition |
| redroid-patches | https://github.com/remote-android/redroid-patches | AOSP patches for redroid builds |
| Docker Hub image | https://hub.docker.com/r/redroid/redroid | Official images: `redroid/redroid:16.0.0-latest` (multi-arch, arm64 available) |

## OCI-specific notes

- Oracle's Ampere A1 kernel (6.17.0-1007-oracle on Ubuntu 24.04 aarch64) does not ship binder/ashmem by default. redroid-modules must be built and loaded. There is an open PR on redroid-modules (#21, kernel 6.8+ support) and a follow-up patch comment specifically validating a full Android 16 boot on `6.17.0-1007-oracle` aarch64 — so this is a known, solved path, not a guess.
- Fallback: `androidboot.use_memfd=1` lets redroid use memfd instead of ashmem if the module build fails.
- Always Free allocation is now 2 OCPU / 12 GB (cut from the old 4/24). Size the container accordingly; one redroid instance is fine, multiple will be tight.
- No Play Store by default. For account-mirroring / auth flows this is acceptable; GMS can be added later if needed.

## Use case fit

The goal is not blazing-fast Android. It is a persistent, secure Android environment in the cloud for:

- Account mirroring (auth sessions live in the container, not on the personal device)
- Basic Android tasks driven agentically (ADB on :5555, scrcpy for mirroring)
- Isolation: nothing disrupts the local phone

Speed-critical work stays on local Android or the Grasshopper/Kali OCI workstations. redroid is the slow-but-persistent lane.

## Deploy sketch (OCI Ampere A1)

```bash
# 1. Kernel modules (from redroid-modules)
git clone https://github.com/remote-android/redroid-modules.git
cd redroid-modules && sudo make && sudo make install
sudo modprobe ashmem_linux
sudo modprobe binder_linux devices=binder,hwbinder,vndbinder

# 2. Run redroid (arm64 image)
docker run -itd --rm --privileged --pull always \
  -v ~/redroid-data:/data \
  -p 5555:5555 \
  --name redroid \
  redroid/redroid:16.0.0_64only-latest

# 3. Connect
adb connect <oci-ip>:5555
scrcpy -s <oci-ip>:5555   # mirror
```

## Open items

- [ ] Build and load redroid-modules on the OCI host; confirm /dev/binder and /dev/ashmem exist
- [ ] Boot redroid 16 arm64; confirm ADB on 5555 and a home screen via scrcpy
- [ ] Wire redroid lifecycle into Grasshopper's cloud-android adapter (start/stop/snapshot)
- [ ] Decide GMS inclusion for account flows
- [ ] Storage cleanup on OCI (see trash repo, branch cleanup/oci-storage-2026-10)
