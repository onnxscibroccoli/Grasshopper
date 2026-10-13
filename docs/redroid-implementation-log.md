# Redroid OCI Implementation Log

**Evidence date:** October 13, 2026  
**State:** **BLOCKED: host Binder kernel ABI compatibility**. No Redroid process or kernel module has been installed or started.

## Source and privacy policy

All Grasshopper repository source reads are from the canonical `main` branch. Do not read historical raw commit-SHA refs or unmerged project branches. Changes are proposed in a draft PR; human approval is mandatory for merging. Never publish personal contact details, health information, credentials, OCI session files, Android guest disks, access tokens, or authenticated application state.

## Objective

Host one persistent, privately controlled Android 16 userspace worker on the existing OCI Always Free A1 ARM64 workstation, integrated with Grasshopper's device lifecycle and Broccoli Core's semantic accessibility/action control schema. Maintain separately accessible Kali and Linux workstations, native Android companion authentication, voice/chat development and model/API/MCP federation. Prefer free/open-source self-hosted components. An event observation must not replay its originating action.

## Verified OCI environment

- Host: **Oracle Linux 9.8**, ARM64, UEK **`6.12.0-206.104.4.4.el9uek.aarch64`**. Earlier Ubuntu 24.04 / kernel 6.17 claims were incorrect for this host.
- Resources: 2 OCPU / approximately 12 GiB allocated, around 3.4 GiB memory available when measured; active QEMU Android consumes about 2.8 GiB RSS.
- Data volume: `/srv/grasshopper`, around 60 GiB free following selective removal of three **inactive** QEMU experiments (29,021,933,568 bytes recovered).
- Boot/root disk: around 94% full. Rootless Podman stores layers there; a Redroid deployment must use a separate, appropriately authorized container store on the persistent volume.
- Access: Grasshopper and Kali RDC were online; existing browser/noVNC and protected nginx routes returned HTTP 200. Production service continuity, not full GUI acceptance, was proven after cleanup.
- Existing QEMU Android is **not Kali**. Its loopback ADB port returned a correct ADB handshake; protect it until a replacement is independently verified.
- `CONFIG_ANDROID_BINDER_IPC` **not set**, Binder/hwbinder/vndbinder character devices missing. `CONFIG_MEMFD_CREATE=y`; memfd avoids ashmem but **not Binder**.
- OCI CLI: The `OMNIKALI` profile's local security-token session and a signed API request both **passed after operator browser authentication**. A read-only instance-agent plugin query passed and showed the Run Command plugin RUNNING. This does **not** imply privileged host access or cloud resource mutation permissions.

## Upstream and reproducible UEK investigation

- Official source: `remote-android/redroid-doc`, `remote-android/redroid-modules`.
- Requested 6.8+ patch: `https://github.com/remote-android/redroid-modules/pull/21`. It was reported working on Ubuntu 6.8; Oracle's UEK 6.12 does not expose the same security-hook API and memory-management symbols.
- Exact signed kernel development package `kernel-uek-devel-6.12.0-206.104.4.4.el9uek.aarch64.rpm` downloaded from Oracle's UEKR8 repository, signature and payload verified, and extracted **without privilege** to a private attached-volume research workspace.
- Host GCC 11 cannot compile the kernel's `-fmin-function-alignment=8`; the host's GCC 14 toolset prefix did not contain a gcc binary. GCC 15 is installed; diagnostic builds with GCC 15 advanced through source after a local BinderFS prototype and Oracle LSM API adjustment.
- The local LSM adjustment selected `security_secid_to_secctx(u32, char **, u32 *)`, `security_release_secctx(char *, u32)` and `security_task_getsecid_obj`, matching Oracle UEK header signatures, rather than assuming the 6.8+ upstream `struct lsmcontext` API.
- Diagnostic `-Wno-error=missing-prototypes` enabled progression to `MODPOST`, **but is not a production-quality solution**.
- Final linker failure: `zap_page_range_single` is **not exported** to external modules on the current Oracle kernel. No `binder_linux.ko` was generated, installed or loaded.
- Upstream Linux kernel discussions state that exported `zap_vma_ptes` only handles `VM_PFNMAP` mappings. Binder mappings use `VM_MIXEDMAP`; **blind substitution is not semantically safe**.
- The PR #21 follow-up for ashmem on **6.17+** is not a fix for the current Binder symbol problem.

## Safe Binder resolution strategy

1. **Preferred:** build, verify and package an Oracle UEK kernel with Binder/BinderFS **in-tree** using the Oracle kernel source corresponding to the running kernel and exact configuration. Unlike an out-of-tree Binder module, an in-tree driver may legally link unexported internal symbols. Build/test completely in an isolated workspace or free GitHub Actions runner without replacing the running kernel. Validate boot configuration, secure boot/module signing, ramdisk, SELinux and recovery.
2. **Alternative:** design and test an ABI-compatible external Binder allocator that does not depend on `zap_page_range_single`; prove correct unmapping and reclaiming of `VM_MIXEDMAP` under memory pressure. Never use kprobe address lookup to bypass kernel symbol export restrictions or disable SELinux. An experimental build alone is not acceptance.
3. Privileged installation/bootloader or kernel changes are prohibited until external recovery is independently verified and explicit operator approval is recorded. No shared-host reboot, network or root disk mutation occurred as part of this investigation.

## Deployment admission and integration

`scripts/cloud-android/oci-redroid-admission.sh` is a **read-only, machine-readable** gate for ARM64/kernel, Binder devices, persistent volume capacity, host memory, QEMU coexistence, container privileges/graphroot and private ADB port. It was executed on OCI and correctly returned **BLOCKED (exit 2)**. The separate initial `redroid-device.sh` draft is not a production release.

After Binder and privileges are proven, configure isolated rootful Podman storage on `/srv/grasshopper` **without relocating or damaging existing rootless Podman/Ollama state**. Bind host ADB only at `127.0.0.1:5556` and persist Android data on the attached volume. The target image is `redroid/redroid:16.0.0_64only-latest` with `androidboot.use_memfd=1`. Confirm image authenticity/architecture and permissions before running.

Accept only after `sys.boot_completed=1`, authenticated/loopback ADB, Android release, interactive display and keyboard, snapshot/restore, reconnect/reboot persistence, protected desktops, service health and human authentication gateway acceptance are independently tested.

## Status summary

| Gate | State |
| --- | --- |
| OCI CLI browser authentication | VERIFIED |
| OCI signed API call | VERIFIED |
| OCI Run Command plugin presence | VERIFIED (RUNNING) |
| Oracle 6.12 headers | VERIFIED (signed archive) |
| PR #21 out-of-tree Binder build | BLOCKED at unexported symbol |
| Binder character devices | MISSING |
| Rootful container + volume store | NOT CONFIGURED |
| Redroid boot/home screen | NOT PROVEN |
| Grasshopper runtime acceptance | NOT PROVEN |
| Old QEMU cleanup | 27.03 GiB recovered; active guest preserved |

Keep this log and the master knowledge graph in sync after each verified milestone. Never promote a design or process-only check to a deployment PASS.
