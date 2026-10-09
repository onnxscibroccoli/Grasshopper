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

The provider-neutral inventory at `docs/ARM64_USERDEBUG_BUILDER_CANDIDATES.json` is checked against `schemas/grasshopper-builder-candidate-inventory-v1.schema.json` and the admission policy with:

```sh
npm run verify:cloud-android-userdebug-candidates
```

The dependency-free schema runner implements only the Draft 2020-12 keywords used by this checked-in schema. Other schemas should use a complete JSON Schema implementation unless their keyword set is explicitly covered and tested.

The verifier derives classification from identity, protection/provisioning boundaries and the resource policy. Even a passing static snapshot yields only `ELIGIBLE_FOR_LIVE_COLLECTION`; it cannot emit build authorization or substitute for the hashed `LIVE` evidence gate.

## Provider-neutral control evidence

`schemas/grasshopper-android-control-evidence-v1.schema.json` defines one evidence format for workstation, browser and physical-Android control origins. Copy `docs/implementation/evidence/ANDROID_CONTROL_EVIDENCE_TEMPLATE.json` beside a new evidence bundle and replace its `NOT_PROVEN` values only with measurements from one source SHA, node, transport and session.

```sh
node scripts/cloud-android/verify-control-evidence.mjs /absolute/evidence/control.json
```

Each PASS gate must bind its own artifact bytes and SHA-256. Delivery proves only the original sequence dispatch. Distinct before/after frames prove only a visible acknowledgement. Semantic effect requires a separately stated expected and observed result. Reconnect continuity requires the same session identity, advancing sequence, client-only disconnect and no guest restart. A `TEST_FIXTURE` bundle always evaluates to `NOT_PROVEN`, even if every internal gate passes. This verifier cannot independently close R2.

### Workstation RFB observation adapter

`adapt-rfb-observation.mjs` consumes an observation-only manifest plus existing frame files from one evidence directory. It never connects to RFB, injects input or replays the operation recorded in the manifest.

```sh
node scripts/cloud-android/adapt-rfb-observation.mjs \
  /absolute/evidence/rfb-observation.json \
  /absolute/evidence/control-evidence.json
```

The input shape is illustrated by `docs/implementation/evidence/WORKSTATION_RFB_OBSERVATION_FORMAT.json`. The adapter verifies both frame byte counts and SHA-256 digests and refuses to overwrite an existing output. Different frame hashes produce only `visible_acknowledgement=PASS`. Because an observed operation is not proof of original dispatch, delivery, semantic effect and reconnect continuity remain `NOT_PROVEN`; so do overall acceptance and R2. An unchanged frame remains `NOT_PROVEN` rather than becoming a failure or inferred acknowledgement.

### Browser reconnect observation adapter

`adapt-browser-reconnect-observation.mjs` consumes a browser observation manifest and an independently captured, digest-bound reconnect record from the same evidence directory. It performs no browser, WebSocket or RFB connection and sends no input.

```sh
node scripts/cloud-android/adapt-browser-reconnect-observation.mjs \
  /absolute/evidence/browser-reconnect-observation.json \
  /absolute/evidence/control-evidence.json
```

See `docs/implementation/evidence/BROWSER_RECONNECT_OBSERVATION_FORMAT.json` and `BROWSER_RECONNECT_RECORD_FORMAT.json` for the two input shapes. A reconnect PASS requires exact source/node/transport binding, identical pre/post session IDs, an advancing sequence, a client-only disconnect, no guest restart and chronological timestamps. The adapter validates record bytes and SHA-256 and refuses output overwrite. It cannot infer delivery, visible acknowledgement or semantic effect, and no output can independently close R2.

### Physical-Android Broccoli Rish observation adapter

`adapt-physical-android-rish-observation.mjs` consumes a digest-bound observation record produced outside Grasshopper through the canonical Broccoli boundary. The record must name `onnxscibroccoli/broccoli-core`, `lib/rish_run.sh`, exact Git commit and blob identities, and `RISH_PRESERVE_ENV=0`. It also binds source SHA, physical node, session and sequence and requires a successful Android `uid=2000`, `u:r:shell:s0` observation.

```sh
node scripts/cloud-android/adapt-physical-android-rish-observation.mjs \
  /absolute/evidence/physical-rish-observation.json \
  /absolute/evidence/control-evidence.json
```

The input shapes are documented in `PHYSICAL_ANDROID_RISH_OBSERVATION_FORMAT.json` and `BROCCOLI_RISH_RECORD_FORMAT.json`. This script contains no Rish launcher and never contacts a phone, dispatches input or replays an observed operation. A wrapper-bound record is only provenance: delivery, visual acknowledgement, semantic effect, reconnect continuity, overall acceptance and R2 remain `NOT_PROVEN`. The canonical wrapper is not copied or modified here.

### Provider-neutral evidence bundle index

`verify-control-evidence-bundle.mjs` verifies an index over exactly one workstation, browser and physical-Android control-evidence document. Each entry binds the document's exact byte count and SHA-256 plus its source SHA, node, transport, origin and session.

```sh
npm run verify:android-control-evidence-bundle
node scripts/cloud-android/verify-control-evidence-bundle.mjs /absolute/evidence/bundle.json
```

The verifier evaluates each embedded document with the ordinary control-evidence verifier but preserves the three gate maps independently. It rejects duplicate or missing origins, source/session mixing, node or transport substitution, missing/tampered artifacts and collection-mode relabeling. It never dispatches, connects or replays. Even a valid `LIVE` index reports overall status and R2 as `NOT_PROVEN`; separate end-to-end acceptance must close those gates.

### Per-origin control-gap report

`report-control-evidence-gaps.mjs` accepts the same verified bundle and emits only a deterministic assessment:

```sh
npm run report:android-control-gaps
node scripts/cloud-android/report-control-evidence-gaps.mjs /absolute/evidence/bundle.json
```

The output binds the bundle's own SHA-256 and byte count, preserves source/session/node/transport/evidence identities, and lists every non-PASS gate under its original control origin. It has no command or action field and cannot connect, dispatch or replay. It never combines complementary gates across origins; overall status, live acceptance and R2 remain `NOT_PROVEN` even when the input bundle is structurally valid.

### Non-executable acquisition requirements

`verify-control-acquisition-requirements.mjs` validates a requirements manifest against both its exact gap-report artifact and the original evidence bundle:

```sh
npm run verify:android-control-acquisition-requirements
node scripts/cloud-android/verify-control-acquisition-requirements.mjs \
  /absolute/evidence/requirements.json \
  /absolute/evidence/gap-report.json \
  /absolute/evidence/bundle.json \
  --at 2026-10-09T00:35:00Z
```

Verification re-generates the gap report from the bundle, so a digest-valid but substituted report still fails. Source/session and every origin's node, transport, evidence digest and missing gates must match. The guest-process binding includes node, PID, start time, observation time and fingerprint; observation may be at most five minutes old when issued, and expiry may be at most twenty minutes after observation. The schema prohibits undeclared execution fields and pins `collection_authorized=false`, live acceptance false and R2 `NOT_PROVEN`. This is a requirements artifact, not a collector or dispatcher.
