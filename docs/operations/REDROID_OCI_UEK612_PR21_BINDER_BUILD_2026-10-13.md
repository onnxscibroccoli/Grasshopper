# OCI UEK 6.12 Redroid Binder — PR #21 Build Investigation

**Date:** 2026-10-13  
**State:** Verified reproducible compile/link blockers; **no kernel module loaded, no Redroid deployment, no reboot**.  
**Source discipline:** The project's canonical source reads were from `main`. Third-party compatibility code was deliberately obtained from the named **upstream PR #21 contributor's `master` branch**, not a raw commit-SHA URL. Private source work remains under the existing OCI data volume and must not be copied into GitHub without a separate code/license/security review.

## Host admission and protected baseline

- Running host: Oracle Linux 9.8, aarch64, UEK `6.12.0-206.104.4.4.el9uek.aarch64`.
- `CONFIG_ANDROID_BINDER_IPC` is **not set**, `CONFIG_MEMFD_CREATE=y`; no Binder character devices exist.
- Root filesystem ~94% used; persistent data volume under `/srv/grasshopper` ~60 GiB available after earlier cleanup.
- Working Grasshopper and Kali desktops, RustDesk, nginx and existing Android QEMU were not restarted or modified.
- User-level container runtime is rootless Podman storing image layers on the root disk. Kernel build/install/load privileges are **not** implicitly present.
- OCI instance-principal CLI read-only region listing worked without browser authentication. This does not prove any permission for OCI resource mutations or privileged host module installation.

## Upstream sources and exact prerequisite

1. `remote-android/redroid-modules` PR #21: `https://github.com/remote-android/redroid-modules/pull/21`; upstream maintainer base is `master`, contributor head is `djamic/redroid-modules:master`. Patch includes Binder filesystem rename signature changes, modern LSM hook signatures, newer shrinker/inode APIs and `load_modules.sh`.
2. Main Redroid documentation: `https://github.com/remote-android/redroid-doc` and `https://github.com/remote-android/redroid-doc/blob/master/deploy/README.md`.
3. The **exact running** kernel development RPM is `kernel-uek-devel-6.12.0-206.104.4.4.el9uek.aarch64.rpm` from `https://yum.oracle.com/repo/OracleLinux/OL9/UEKR8/aarch64/`.
4. Upstream PR #21 follow-up discussing `mm_get_unmapped_area` and `vfs_mmap` targets **kernel 6.17+**; the running host is **6.12**. Do not blindly apply it for this blocker. For Redroid, `androidboot.use_memfd=1` bypasses ashmem dependency, **not Binder**.

## Executed isolated build experiment (not production)

A restricted research worktree was placed at `/srv/grasshopper/android/development/redroid-uek612-pr21`. The officially published matching UEK development RPM was downloaded there and its RSA/SHA256 signature and payload digests verified by `rpm -Kv`. Header contents were extracted **rootlessly**, with `rpm2cpio | cpio`, into a local `headers` directory. The kernel `Makefile` and `Module.symvers` were both present.

The PR contributor's source was cloned with `--single-branch --branch master`; no raw commit-SHA code checkout was used.

Build interface:

```bash
# Run only from the isolated, already-staged worktree on the OCI host.
WORK=/srv/grasshopper/android/development/redroid-uek612-pr21
KDIR="$WORK/headers/usr/src/kernels/6.12.0-206.104.4.4.el9uek.aarch64"
cd "$WORK/redroid-modules/binder"
make KDIR="$KDIR" -j1
```

### Observed failures, in dependency order

1. Host GCC **11.5** could not parse the UEK kernel's `-fmin-function-alignment=8` build flag. Oracle's running kernel was built with GCC **14.2.1**.
2. `/opt/rh/gcc-toolset-14/enable` exists but `/opt/rh/gcc-toolset-14/root/usr/bin/gcc` does **not**. That shell enable script did not provide GCC 14.
3. GCC toolset **15.2.1** is available. With this compiler the PR source progressed beyond compiler flag handling, but `binderfs_exit` lacked a prototype. A local forward declaration allowed further compilation.
4. Oracle's 6.12 UEK security header uses `security_secid_to_secctx(u32, char **, u32 *)`, `security_release_secctx(char *, u32)`, and `security_task_getsecid_obj`. PR #21 selects the upstream `struct lsmcontext` 6.8+ signature based only on kernel-version guards, which does **not** match UEK's backported security API. An isolated, explicitly flagged local compatibility change selected the older secctx argument layout and `security_task_getsecid_obj`.
5. Subsequently, GCC 15 encountered multiple `-Werror=missing-prototypes` in the third-party `deps.c`. A **diagnostic-only build** with `KCFLAGS=-Wno-error=missing-prototypes` advanced compilation, **but is not an acceptable release configuration**.
6. At `MODPOST`, the external Binder module still failed: **`"zap_page_range_single" ... undefined!`**. The contributor's Binder allocator directly references `zap_page_range_single`, which is not exported for loadable modules by this Oracle kernel. This is a **kernel symbol/ABI boundary**; no successful `.ko` or Binder device was produced.

These are verified local engineering findings, not evidence of upstream production compatibility. No native kernel parameters, kernel packages, system modules, mounts or protected guest images were modified.

## Recommended technical resolution

**Do not install the unverified module, switch kernels in-place or load an unsafe symbol-resolution shim on the only OCI access workstation.** Two bounded approaches remain:

A. **Preferred low-risk technical design:** Investigate a packaging or upstream-accepted patch using only exported UEK page-unmap APIs whose semantics match the Binder allocator, with complete tests and vendor symbol verification. Direct substitution without a mapping/reclaim correctness proof is not acceptable.

B. **Supported but higher-risk fallback:** Build a matching Oracle UEK kernel with Android Binder/BinderFS configured as `m` or `y` in a separate sandbox, retaining the original boot entry, verifying EFI/GRUB rollback and tested out-of-band instance recovery **before** any kernel boot change. This path requires privileged host installation and a carefully scheduled, authorized reboot. It must not be attempted merely because the third-party external module compiled.

## Next acceptance gates

1. Locate a correct, vendor-compatible implementation of the Binder allocator page unmapping that does not depend on unexported `zap_page_range_single`, or plan a tested custom-kernel route with independently verified recovery.
2. Obtain a complete matching GCC14 toolchain and rebuild *without warnings-as-errors bypasses*. Record module metadata, vermagic and symbol versions.
3. Determine whether the allowed OCI access path provides scoped privileged module administration; authenticate only if it is genuinely required.
4. Only after safe Binder device proof: migrate rootful/container image storage to the attached data volume, reserve host memory, boot Redroid, verify Android 16 `sys.boot_completed=1`, ADB loopback-only, screen/IME and persistent sessions.
5. Protect existing Kali, Grasshopper, RustDesk and the still-partly-functional QEMU Android throughout; preserve the ability to roll back without a login-dependent rescue.

**Disposition:** Binder compatibility **blocked at unexported kernel symbol**, not fixed by PR #21 alone on UEK 6.12. No claim of deployed Redroid.
