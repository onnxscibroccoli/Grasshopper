# Mobile policy local evidence — 2026-10-19 ET

Recorded at 2026-10-20T01:05Z (2026-10-19 21:05 America/New_York).

## Source pins

- Grasshopper baseline: PR #204, `3eef009aa4a88f6d81dbd082cd35b90379929518`.
- Local policy implementation: `4b9ca71af367a1b207e87d15a8c7889512a899a4`.
- broccoli-core checkout inspected, unchanged: PR #77 merge,
  `f66678ea9749c6c22519028c39dc00d5c9e3bae1`.
- Grasshopper #197 observed open, draft, non-mergeable at
  `1b04aed5727ae32e23eea4ffa6cd88635f6307fb`; not rebased here.

## Validation

- Focused envelope + hook suite: 37 passed, 0 failed.
- Full `npm test`: 231 passed, 0 failed.
- `git diff --check`: passed.
- Standalone `node scripts/verify-no-broccoli-degradation.mjs`: FAILED:
  - `false_shipped:docs/BROCCOLI_KNOWLEDGE_GRAPH.md`
  - `false_shipped:docs/DEGRADATION_LESSONS.md`
  - `marker:docs/PORTABILITY_AND_EXECUTION_BOUNDARIES.md:host and target shells are separate runtimes`
- All three documents are unchanged from the baseline (verified by git diff).
  The standalone audit scans actual docs; the Node suite's guard tests use
  temporary fixture trees, so a passing Node suite does not clear this audit.
- No exact-tip CI evidence or Verify Gate ACCEPT obtained. No merge performed.

## Publication

Push of `feat/mobile-policy-hook-20261019` to
`https://github.com/onnxscibroccoli/Grasshopper.git` was rejected by automatic
approval review: potential disclosure of sensitive source and insufficient
explicit authorization for this branch/destination. No alternate publication
path attempted. GitHub branch read returned 404 after rejection. No PR number.

## Scope and next gates

The hook is an internal pre-execution boundary with a trusted dispatch callback.
It is not a deployed control-plane endpoint, authentication mechanism, durable
ledger, or controller adapter. Local callback tests do not prove the phone path.

Pending: publish the reviewed branch with Ian's approval, resolve the standalone
audit without weakening its guarantees, obtain exact-tip CI and Verify Gate
ACCEPT, implement the broccoli-core adapter using its durable ledger, add the
multi-controller registry, rebase #197 in isolation, and run the dated full-chain
probe. No phone, production host, live checkout, secrets, or listener changed.
`live_device_acceptance` remains NOT_RUN.
