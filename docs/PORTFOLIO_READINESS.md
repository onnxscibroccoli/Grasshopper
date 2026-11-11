# Portfolio reviewer readiness — Grasshopper

> **Status:** Reviewable documentation plan, not a production certification. **As of:** 2026-11-11. **Tracking:** [local issue](https://github.com/onnxscibroccoli/Grasshopper/issues/212) · [cross-repository ledger](https://github.com/onnxscibroccoli/broccoli-core/issues/102).  
> Do not interpret AI-assisted source development, successful offline tests or simulations as independently verified industry employment, compliance, or live operations.

## One-minute technical orientation

**Focus:** Agent control plane, transactional state, and recovery. An agent/task control plane with executable lifecycle contracts, lease generation/fencing, idempotent task reservation, an experimental opt-in SQLite WAL store, and multi-process lost-update regression scenarios.

**What is demonstrable:** The listed source files and explicitly scoped CI runs can be inspected. A reviewer can evaluate the code, rerun supported unit tests, and challenge the architecture decisions. Any claimed practical capability requires the corresponding test, environment, and source revision; not all systems are integrated or generally available.

## Source and reviewer starting points

| Evidence | Path |
| --- | --- |
| Task state machine and fencing | [Inspect](https://github.com/onnxscibroccoli/Grasshopper/blob/main/src/control-plane.mjs) |
| SQLite WAL transactional backend | [Inspect](https://github.com/onnxscibroccoli/Grasshopper/blob/main/src/transactional-state-store.mjs) |
| Cross-process concurrency tests | [Inspect](https://github.com/onnxscibroccoli/Grasshopper/blob/main/test/transactional-state-store.test.mjs) |
| Reference test workflow | [Inspect](https://github.com/onnxscibroccoli/Grasshopper/blob/main/.github/workflows/reference-tests.yml) |

## Executed CI references (historical, scoped)

| Check | Exact run |
| --- | --- |
| Reference tests (development branch) | [Run 43010665531](https://github.com/onnxscibroccoli/Grasshopper/actions/runs/43010665531) |
| Scheduled control-plane workflow | [Run 43044844568](https://github.com/onnxscibroccoli/Grasshopper/actions/runs/43044844568) |

These run links refer to the specific branch/commit shown on GitHub. They must not be silently attributed to a different current HEAD, production environment, device or approval state.

## Reproduce the relevant local checks

After cloning the repository and reviewing dependencies and safe environment requirements:

```sh
node --test test/*.test.mjs
```

This is a **documented command**, not a claim that this portfolio PR executed it. Some modules require dependencies or privileges, and a missing dependency must be reported rather than converted into a false PASS.

## Ordered actionable changes

1. [ ] Expose one supported offline demo of task reservation, fencing and recovery, including expected failure modes.
2. [ ] Link source/test/CI on reviewer page; identify the commit/branch per run.
3. [ ] Document JSON-store lost-update defect and distinguish opt-in SQLite WAL from default behavior.
4. [ ] Require a separate authenticated, live executor acceptance run before advertising durable external side-effect fencing.
5. [ ] Prioritize actual cross-process behavior and agent failure injection over adding more generated architecture prose.

## Maturity and verification boundary

The default file-backed JSON store has known lost updates under competing processes. The SQLite WAL backend is opt-in; external side-effect fencing and live production readiness remain unproven.

## Release and artifact strategy

Produce an offline demo bundle only after dependencies and test scenarios are reproducible on a clean host.

## Safe continuation after interruption

1. Follow the local issue and the [master execution ledger](https://github.com/onnxscibroccoli/broccoli-core/issues/102); inspect existing PRs before creating new ones.
2. Check `git rev-parse HEAD`, repo default branch, current feature branches and fresh Actions conclusions.
3. For each checklist item, implement the smallest change on a reviewable PR; record exact SHA, test scope, successes, failed/untested checks and outstanding decisions.
4. Keep a previously failing independent-approval requirement or live-device gate unresolved until a legitimately authorized actor/environment supplies evidence.
5. Re-read this document against source after changing implementation. Do **not** mark a checklist item complete merely because it is documented.

**Human-only / outside repository assertions:** employment history, professional tenure, team-management responsibilities, third-party audit and approvals.