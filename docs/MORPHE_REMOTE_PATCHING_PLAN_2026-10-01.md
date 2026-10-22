# Remote APK / Morphe Patching Architecture - 2026-10-01

## Objective

Move resource-intensive APK analysis and patching off the Android phone while preserving a simple Android workflow:

`observe installed app -> acquire original APK -> inspect -> select patch set -> patch remotely -> verify artifact -> transfer -> human-gated install -> post-install verify`

The Android device remains the execution and human-interaction plane. Cloud hosts become disposable/reproducible patch workers with persistent caches and logs.

## Current Morphe evidence

Morphe's public project provides:

- Morphe Manager for Android
- Morphe Patcher as a reusable patching library
- Morphe Desktop with CLI and GUI
- Morphe Patches as patch bundles
- a patch template for third-party patch sources

Morphe Desktop documents Java 21+ as a prerequisite and accepts APK/APKM inputs plus `.mpp` patch bundles. The CLI supports patch-source URLs, local `.mpp` files, options JSON, result JSON, APK verification with an Android SDK, architecture filtering, and automatic installation when an ADB device is connected.

Morphe Patcher explicitly supports Dalvik bytecode, APK resources, arbitrary APK files, and modular patches.

## Proposed persistent worker

Canonical candidate:

`oci-grasshopper-workstation`

Reason for role assignment:

- already persistent
- ARM64
- Oracle Linux 9.8
- already connected through RDC
- appropriate for Java 21 / APK tooling workloads

AWS remains a valid secondary worker:

`aws-helix-worker-01`

The patch scheduler should target a logical `apk-patch-worker` capability rather than hard-code a cloud provider.

## Worker contract

Every patch job gets a durable ID:

`APKPATCH-<timestamp>-<random>`

The job record contains:

- source package name
- source APK SHA-256
- source version/versionCode
- split APK manifest when applicable
- patch-source repository and release
- exact `.mpp` artifact hash
- Morphe Desktop/Patcher version
- Java version
- options JSON hash
- worker identifier
- output APK SHA-256
- signing certificate fingerprint
- verification results
- installation target identifier
- final Android UI verification evidence

No artifact is considered ready for installation without these fields.

## Patch pipeline

### Phase 1: acquire

Get the original APK or split set from an attributable source.

Do not patch an APK whose provenance, package name, version, or hash is unknown.

### Phase 2: inspect

Run APKTool/AAPT2/JADX or Morphe inspection on the cloud worker.

Produce:

- manifest
- package/version metadata
- permissions
- activities/services/receivers
- resource IDs
- layouts
- DEX inventory
- native libraries
- split relationships
- source hash

### Phase 3: patch

Prefer Morphe Patcher/Morphe Desktop for Morphe-compatible work.

APKTool remains a low-level analysis/build tool, not the primary patch abstraction.

### Phase 4: verify

At minimum:

1. APK structural validation
2. package/version validation
3. DEX/resource rebuild validation
4. signing verification
5. architecture validation
6. optional Android SDK verification
7. static inspection of the output
8. installability check on the target device
9. post-install UI observation

### Phase 5: deliver

Transfer the verified APK to `android-phone-a146u`.

Installation is a separate action and may require a human gate.

The agent never bypasses Android security prompts, authorization, CAPTCHA, biometric verification, or other human security boundaries.

## Custom patch distribution

For patches intended for other people:

- maintain a dedicated patch-source repository
- build versioned `.mpp` releases
- keep patch source code and release metadata in Git
- publish reproducible build metadata
- distinguish patch source from patched APK artifacts
- use distinct branding for derivative products as required by Morphe's license terms

Morphe documents GitHub/GitLab patch-source URLs and a patch-source template, so this can become a normal release workflow rather than a phone-local one.

## Why this is better than putting APKTool on the phone

- avoids consuming Android RAM/storage during heavy decoding
- preserves phone responsiveness for human interaction
- allows larger JVM heap and repeatable worker configuration
- makes failures reproducible
- enables caching of APK analysis and patch artifacts
- lets multiple Android devices share the same patch worker
- keeps the Android transport layer small and deterministic

## Future optimization

The first implementation should not duplicate the entire Morphe pipeline.

Instead:

1. make the worker contract stable
2. run Morphe Desktop/Patcher remotely
3. cache original APK and patch bundle hashes
4. add deterministic verification
5. add Android transfer/install orchestration
6. only then optimize with custom APKTool/Morphe integrations

## Evidence state

PROVEN:
- Morphe Manager, Patcher, Desktop, and patch-source projects exist
- Morphe Patcher supports bytecode/resources/arbitrary APK files
- Morphe Desktop supports Java 21+ and CLI patching
- custom patch bundles are a supported model

PLANNED:
- persistent remote patch worker
- Grasshopper patch-job orchestration
- cloud APK artifact transfer
- custom patch source for OmniKali-related workflows

NOT_PROVEN:
- this phone's complete Morphe source/build provenance
- a successful remote Morphe patch executed by OmniKali
- automatic phone install and post-install verification
