# ARM64 full-userdebug clean-builder plan

**Status:** `BLOCKED_RESOURCE_ADMISSION`

**Latest contract:** `OCI-ARM64-USERDEBUG-CANDIDATES-20261008-08`

**Candidate artifact:** `NOT_BUILT`

This plan prepares a reproducible full `virtio_arm64only userdebug` UTM image. It does not authorize a build, a cloud purchase, a VM launch, or use of the running OCI Android guests.

## Pinned source and patch

- Repository: `https://github.com/jqssun/android-lineage-qemu.git`
- Tag: `v2026.07.09`
- Commit: `54fc5dc82fa05778be15c1200240be53f707a542`
- `build.sh` Git blob: `b5babcdbefa664b1ffc447bda4dcf53b17628cb6`
- Patch: `deploy/cloud-android/patches/full-arm64-userdebug.patch`

The patch changes only the full ARM64 VM build from `user` to `userdebug`. The upstream recovery-only userdebug build remains unchanged.

## Admission envelope

Official LineageOS guidance for current branches calls for at least 32 GiB RAM and 300 GB storage. Grasshopper adds conservative isolation requirements so the build cannot starve an Android worker:

- architecture: AArch64;
- at least 8 logical CPUs;
- at least 32 GiB total and 24 GiB currently available RAM;
- at least 300 GiB free in the isolated build workspace;
- one-minute load no higher than half the logical CPU count;
- zero running QEMU processes on the builder;
- maximum build lease of 24 hours;
- an absolute checkpoint path on persistent storage.

`scripts/cloud-android/admit-arm64-userdebug-builder.mjs evaluate` evaluates recorded snapshots for planning and tests but labels them `SIMULATED`. Simulated evidence cannot authorize a build.

`scripts/cloud-android/collect-arm64-userdebug-builder.mjs collect` is the live collector. It reads CPU, memory, load, workspace capacity and `/proc/<pid>/exe`, writes a new evidence file without overwriting an existing record, and binds the profile, snapshot and replayed admission result with SHA-256. Only the literal `/proc` source is labeled `LIVE`; alternate process roots are labeled `TEST_FIXTURE`. Incomplete process visibility adds `process_scan_ambiguous` and blocks admission. The `verify` command recalculates every digest and replays policy against the snapshot.

The live collector must run only on a genuinely isolated builder. It was deliberately not run on the active OCI Android workstation because that node already fails the static envelope and hosts QEMU.

The 2026-10-08 OCI workstation observation fails this envelope: 2 logical CPUs, about 10.6 GiB total/4.9 GiB available RAM, about 46.6 GB free in the Android workspace, and one active two-vCPU QEMU process. The build therefore stays blocked.

## Existing no-new-capacity candidates

`docs/ARM64_USERDEBUG_BUILDER_CANDIDATES.json` records the bounded inventory. `verify-arm64-userdebug-builder-candidates.mjs` recomputes every classification from the pinned resource policy. Static capacity that meets the envelope becomes only `ELIGIBLE_FOR_LIVE_COLLECTION`; it never authorizes a build. Protected nodes, unidentified endpoints, nodes requiring provisioning and resource-blocked hosts remain excluded or unqualified.

No existing candidate qualified on 2026-10-08:

- OCI `grasshopper-workstation`: identity verified, but blocked by CPU, RAM, workspace and active QEMU;
- RDC `localhost`: listed online, but its bounded identity probe timed out with no result and was not replayed;
- GCP: no existing authorized compute node was available; no API or capacity was enabled;
- AWS base: protected, offline and excluded without contact.

The inventory status is `NO_ELIGIBLE_NODE` and `build_authorized` remains `false`.

## Reproducible workflow after live admission

1. Create a new isolated build directory on the admitted builder; do not reuse any Android guest state directory.
2. Collect and verify a `LIVE` builder-admission evidence file. Stop if its status is not `PASS`.
3. Clone the pinned repository and detach at commit `54fc5dc82fa05778be15c1200240be53f707a542`.
4. Confirm `git hash-object build.sh` equals `b5babcdbefa664b1ffc447bda4dcf53b17628cb6`.
5. Apply `full-arm64-userdebug.patch` with `git apply --check` followed by `git apply`.
6. Run the pinned upstream dependency/source-sync portion, then build `breakfast virtio_arm64only userdebug` with `m vm-utm-zip otapackage`.
7. Require exactly one emitted `UTM-VM-lineage-*-virtio_arm64only.zip`; rename it with the `-userdebug.zip` suffix.
8. Copy `out/target/product/virtio_arm64only/system/build.prop` beside the archive.
9. Fill the provenance template using measured byte sizes and SHA-256 digests.
10. Run `verify-arm64-userdebug-provenance.mjs`. Retain the admission evidence, source commit, patch digest, logs, manifest, archive and build properties as one evidence set.
11. Do not launch the artifact. Runtime admission and isolated boot acceptance are separate future contracts.

## Checkpoint, timeout and recovery

- Checkpoint after source sync and again after successful compilation, retaining the repo manifest and source/patch identities.
- Stop the build when its 24-hour lease expires; preserve logs and the latest complete checkpoint.
- Cleanup may remove only the explicitly allocated isolated build directory after evidence retention. It must never target a guest state directory, Podman root, repository worktree, `/srv`, `$HOME`, or `/`.
- Recovery is restore from the last verified build checkpoint or start from a clean directory. It never restarts or modifies an Android guest.
