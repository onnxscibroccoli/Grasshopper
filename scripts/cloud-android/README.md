# Stage 0 clean Cloud Android

`stage0-clean-device.sh` is the non-destructive admission and evidence gate for the first bidirectional-control doorway.

It records environment identity, source and legacy benchmark lineage, CPU/RAM/swap, KVM/QEMU availability, existing QEMU footprint, and ADB transport signals.

It never starts or stops QEMU. A failed admission exits 75 and leaves existing Cloud Android and Kali sessions untouched.

Stage 0 is not complete until a subsequent disposable boot proves Android identity after admission passes.

## ARM64 image-profile admission

`arm64-device.sh profile-admission` records the automation boundary of the pinned Android 16 archive. Upstream build provenance identifies the full UTM VM archive as a `user` build; its normal ADB shell is therefore conditional on completed interactive provisioning plus explicit ADB enablement and authorization.

`prepare`, `start`, and `restart` fail closed with exit 75 by default. `CLOUD_ANDROID_ARM64_ALLOW_SETUP_GATED=1` admits the image only as `INTERACTIVE_SETUP_ONLY` and continues to report `NORMAL_ADB_SHELL=NOT_PROVEN`. It does not declare the guest automation-ready.

A normal-shell automation profile requires a separately pinned full `userdebug` VM artifact with reproducible build provenance and its own acceptance evidence. The upstream recovery-only `userdebug` image is not a substitute for that VM artifact.

## Full userdebug VM provenance

`environments/cloud-android-arm64-userdebug-build.json` pins the only admitted source and build contract for a future full automation image: upstream tag `v2026.07.09` at commit `54fc5dc82fa05778be15c1200240be53f707a542`, build-script blob `b5babcdbefa664b1ffc447bda4dcf53b17628cb6`, target `virtio_arm64only`, variant `userdebug`, and goals `vm-utm-zip otapackage`.

The upstream script builds only recovery as `userdebug`, then switches to `user` for the full VM. A clean isolated builder must retain `userdebug` for the full VM target, rename the resulting archive with the `-userdebug.zip` suffix, and retain the corresponding product `build.prop`.

Copy `deploy/cloud-android/arm64-userdebug-provenance.template.json` beside those two artifacts and replace every marker with measured values. Verify it before any launch:

```sh
node scripts/cloud-android/verify-arm64-userdebug-provenance.mjs \
  environments/cloud-android-arm64-userdebug-build.json \
  /absolute/path/to/provenance.json
```

The verifier fails closed unless source identity, build target/variant/goals, archive bytes and size, both persistent UTM disks, build-property bytes, `ro.build.type=userdebug`, and `ro.product.cpu.abi=arm64-v8a` are all proven. This repository profile does not authorize a build, paid capacity, guest launch, merge, or deployment.
