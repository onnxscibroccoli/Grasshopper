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

## Clean-builder resource admission

The [clean-builder plan](../../docs/ARM64_USERDEBUG_BUILD_PLAN.md) and `admit-arm64-userdebug-builder.mjs` define the pre-build resource boundary. Snapshot evaluation is deliberately labeled `SIMULATED`; it exercises policy but cannot authorize a live build. The current OCI Android workstation is blocked because it has insufficient CPU, RAM and free workspace and is actively running QEMU.

The pinned source patch is `deploy/cloud-android/patches/full-arm64-userdebug.patch`. It was checked against the exact upstream `build.sh` Git blob and changes only the full ARM64 VM variant from `user` to `userdebug`. No build workflow may run until an isolated builder produces and verifies a `LIVE` admission artifact whose status is `PASS`.

The live collector is now implemented, but no OCI admission record exists because the Android workstation is not an isolated builder. On a qualifying host, use absolute paths and a new evidence filename:

```sh
node scripts/cloud-android/collect-arm64-userdebug-builder.mjs collect \
  environments/cloud-android-arm64-userdebug-build.json \
  /absolute/build/workspace /absolute/checkpoints 24 \
  /absolute/evidence/builder-admission.json
node scripts/cloud-android/collect-arm64-userdebug-builder.mjs verify \
  environments/cloud-android-arm64-userdebug-build.json \
  /absolute/evidence/builder-admission.json
```

Collection never starts or stops a workload. It fails closed on ambiguous process visibility, identifies QEMU from `/proc/<pid>/exe` instead of command-line substring matches, and refuses to overwrite evidence. A valid hashed record can report either `PASS` or `BLOCKED`; only verified `LIVE` evidence whose admission status is `PASS` can authorize the separate build step.

## Existing-builder candidate inventory

The provider-neutral inventory at `docs/ARM64_USERDEBUG_BUILDER_CANDIDATES.json` is checked with:

```sh
node scripts/cloud-android/verify-arm64-userdebug-builder-candidates.mjs verify \
  environments/cloud-android-arm64-userdebug-build.json \
  docs/ARM64_USERDEBUG_BUILDER_CANDIDATES.json
```

The verifier derives classification from identity, protection/provisioning boundaries and the resource policy. Even a passing static snapshot yields only `ELIGIBLE_FOR_LIVE_COLLECTION`; it cannot emit build authorization or substitute for the hashed `LIVE` evidence gate.
