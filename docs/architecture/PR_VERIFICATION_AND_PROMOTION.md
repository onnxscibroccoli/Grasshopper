# Pull-request verification and promotion authority

**Lifecycle:** Locally verified; GitHub Actions and independent review pending.  
**Scope:** `.github/workflows/production-merge-gate.yml` and `test/production-merge-gate-security.test.mjs`.  
**Baseline:** `main` at `3eef009aa4a88f6d81dbd082cd35b90379929518`.  
**Context:** The workflow name `Production merge gate` is intentionally retained to reduce required-check migration risk.

## Why this exists

A pull request may contain code from an untrusted contributor or autonomous agent. Executing its tests with a writable repository token creates a route from **validation** to **repository mutation**. Previously, this workflow gave PR execution `contents: write` and `pull-requests: write`, checked out the PR head, ran `npm test`, and then invoked `gh pr merge --auto`. A passing check was therefore able to enable an automatic merge.

That is a privilege-boundary defect, even when its tests and recovery assertions are useful.

## Trust boundaries

| Boundary | Current contract | Authority |
| --- | --- | --- |
| PR checkout and test | `pull_request` event, PR head SHA, `persist-credentials: false` | Read-only `contents: read` and `actions: read` |
| Contract validation | Existing tests, recovery-path assertions, and required workflow checks | Reports a technical verdict only |
| Manual diagnostic dispatch | `workflow_dispatch` with the same verification checks | Does not mutate a pull request |
| Merge/promotion | Out of this workflow | Authorized maintainer and applicable GitHub branch rules |
| Production deployment | Out of scope | Requires distinct production authorization and evidence |

The workflow does not use `pull_request_target`. The retained `actions: read` permission supports the existing workflow-run status query. No write, deployment, or signing permission is granted to PR code.

The workflow's success is **not** human acceptance and does not assert production readiness. No separate automatic promotion job is created by this increment.

## Regression contract

Run from the repository root:

```sh
node --test test/production-merge-gate-security.test.mjs
npm test
```

The focused regression asserts:

1. The PR event remains enabled and the repository token cannot write.
2. Checkout does not persist the GitHub credential.
3. No automatic merge command or auto-merge input is present.
4. Existing test, recovery, and required-workflow checks are retained.

The first three tests failed against the original source and passed against the corrected workflow in a local staging copy. **Full-repository and GitHub Actions outcomes must be verified against the final PR SHA; they are not established by the local staging test.**

## Failure and recovery behavior

Missing or failed required checks still produce a nonzero verification result. Existing timeout behavior remains fail-closed. No failing verification is bypassed. If the permission change prevents the GitHub CLI from reading workflow statuses, diagnose the minimum required read scope; do not restore write permissions.

Rollback is a normal, reviewed revert of the PR change. Reinstating automatic merging is **not** a default rollback action; any future promotion workflow needs trusted workflow source, explicit artifact/PR identity verification, governance authorization, and separate security review.

## Known limitations and follow-up

- Required-workflow matching still uses the existing `head_sha` query and name-based selection. Its exact-run/rerun semantics need independent verification during evidence-contract hardening.
- Third-party action version pinning and dependency lockfile handling belong to a distinct hardening increment.
- The focused regression is a static guard. It does not replace GitHub Actions execution or an independent permission audit.
- Branch protection/rulesets are not changed and have not been asserted to be effective here.
- No production resource, Android device, or credential is touched.

## Related engineering

- `AGENTS.md`: agent execution authority.
- `docs/SECURITY_PHASE_MODEL.md`: environment boundary.
- `docs/AGENTIC_GITHUB_AUTOMATION.md`: autonomous development flow.
- `README.md`: architecture navigation.
- OmniKali system graph: `onnxscibroccoli/omn-kali-knowledge-graph-master`, `OMNIKALI-SYSTEM-KG-2026-10-01`.

**Verification state:** `LOCAL_STAGED_TEST_PASS`; `PR_CI_PENDING`; `GOVERNANCE_PENDING`; `PRODUCTION_NOT_TESTED`.
