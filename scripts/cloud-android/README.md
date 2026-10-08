# Stage 0 clean Cloud Android

`stage0-clean-device.sh` is the non-destructive admission and evidence gate for the first bidirectional-control doorway.

It records environment identity, source and legacy benchmark lineage, CPU/RAM/swap, KVM/QEMU availability, existing QEMU footprint, and ADB transport signals.

It never starts or stops QEMU. A failed admission exits 75 and leaves existing Cloud Android and Kali sessions untouched.

Stage 0 is not complete until a subsequent disposable boot proves Android identity after admission passes.

## ARM64 image-profile admission

`arm64-device.sh profile-admission` records the automation boundary of the pinned Android 16 archive. Upstream build provenance identifies the full UTM VM archive as a `user` build; its normal ADB shell is therefore conditional on completed interactive provisioning plus explicit ADB enablement and authorization.

`prepare`, `start`, and `restart` fail closed with exit 75 by default. `CLOUD_ANDROID_ARM64_ALLOW_SETUP_GATED=1` admits the image only as `INTERACTIVE_SETUP_ONLY` and continues to report `NORMAL_ADB_SHELL=NOT_PROVEN`. It does not declare the guest automation-ready.

A normal-shell automation profile requires a separately pinned full `userdebug` VM artifact with reproducible build provenance and its own acceptance evidence. The upstream recovery-only `userdebug` image is not a substitute for that VM artifact.
