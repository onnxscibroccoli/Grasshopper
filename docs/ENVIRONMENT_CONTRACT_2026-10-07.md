# GH-ENV-20261007-01

Bounded repository contract: introduce independently testable environment
classification and configuration boundaries without changing a running device.

- Repository: onnxscibroccoli/Grasshopper.
- Branch: feat/environment-contract-20261007.
- Source baseline: fdbd7f244be8094571f8a9426b8c2ccd9b01b259.
- Execution: isolated local Linux x64 checkout, Node 24.19.0; Git transport to
  GitHub. Local source tests are not OCI or physical-device acceptance.
- Lease: this foreground source contract only, deadline 2026-10-08T00:10:00Z;
  no background workers or continuation process installed.
- Resource envelope: no new cloud capacity, VM, container, or image build;
  test runs sequential, each below 10 seconds as observed. No runtime resource
  reservation or production admission is implied.
- Recovery: revert this source commit; compatibility import retained. No guest
  disk, cloud chat, credentials, or remote uncommitted work modified.

## Change and acceptance

The Android memory-admission implementation moves to core with a compatibility
re-export. A pure context classifier and bounded local collector load separate
profiles for OCI, physical Android, emulated Android, and unknown identity.
Profiles retain the canonical broccoli-core physical Rish boundary and permit
remote Android adapters to differ. No wrapper is duplicated or raw-Rish fallback
introduced. Deployment/rebuild/rollback and SemVer release guidance is separate.
Package 0.2.0-dev.1 denotes development work; no release tag is created.

Focused acceptance: 4/4 tests passed for classification, ambiguous identity,
profile validation and admission compatibility. Baseline full suite: 236/236.
Changed suite: first run 239/240, second run 240/240. The initial failure was
`unsupported cancel while in-flight records request without acknowledgement`:
`state.executions` was undefined after an existing fixed 10 ms wait. All 14
executor tests passed in isolation. This is evidence of timing sensitivity,
not proof that the unrelated executor defect is repaired. No executor code or
test was changed or skipped. Production CI remains required on the exact commit.
The degradation guard and git diff whitespace check passed.

The collector on the local non-target Linux host returned context unknown,
exit 78 and liveControl NOT_PROVEN. Device profile tests use supplied facts;
live classification, input and reconnect qualification remain pending.

Implementation SHA-256:

- core/environment/context.mjs: 08c7b16d9f6601f9a708fdd7ec830a7fcee147556f92f03cefc1d9b2e1f78153
- bin/environment.mjs: c329abf7c2dd7f2e44ab1f479091e9280fcd16efd57effe308b3af35a6fd48cc
- core/cloud-android/admission.mjs: 91f58329eea414b20e28a40ad8084742ac6c4694b74cee7a83c1527d267d78cd

## Runtime observations and remaining boundary

OCI identity was verified through RDC and OCI instance metadata before the
read-only inspection. QEMU PID 1054022 was observed near 188% CPU on the two-CPU
host. It differs from the earlier investigated PID, so its current configuration
must be reverified before changing the runtime. The next read-only RDC request
returned HTTP 504; it was not replayed. The physical phone was offline.
Existing ADB/network PASS entries in the integration map are historical evidence,
not fresh acceptance from this contract. R2 remains NOT_PROVEN.

Next contract: identify the current OCI process/configuration, measure guest
CPU consumers and isolate rendering saturation with a reversible experiment.
Do not repeatedly restart the guest or diagnose ADB as an isolated network fault
while the CPU is saturated. After recovery, prove same-source boot/UI, ADB,
keyboard/pointer and reconnect, then independently qualify phone-to-cloud control.
Use a separate development image/state for clean rebuild comparison, preserving
legacy artifacts and the working chat. Full repository migration and live
bidirectional screen control are not completed by these source changes.
