# Grasshopper concurrency and execution ownership: measured baseline

**Lifecycle:** Legacy file-store negative control retained; opt-in SQLite transaction and generation-guarded callback corrections under test.  
**Date:** 2026-11-04.  
**Source baseline:** `main@3eef009aa4a88f6d81dbd082cd35b90379929518`.  
**Target:** `src/store.mjs`, `src/control-plane.mjs`, and the downstream durable executor.

## Plain-language overview

Two independently running agents can read the same saved state and both
write their changes. The final writer replaces the other's data. This is a
**lost update**. The original control plane also allowed an older completion callback to finalize a task after reconciliation marked it orphaned. The dependent reference increment now rejects that stale callback, but device-side fencing remains unproven.

The current JSON state store uses a per-PID temporary file followed by rename.
Rename helps ensure readers do not observe a partially written destination,
but it does **not** serialize independent read/modify/write transactions.
A successful single-process test is not proof of multi-process correctness.

## Adversarial regression evidence

Run from the repository root:

```sh
node --test test/state-concurrency.test.mjs
npm test
```

The baseline PR originally recorded two **negative controls**. The storage negative control remains, while the stale-completion test has been promoted to a required positive invariant on the dependent fencing branch:

1. **Cross-process lost update:** two independent Node processes load one
   version of the JSON snapshot, wait on an IPC barrier, mutate different
   logical records, and then save. The persisted state retains only one
   update. The parent process asserts that the existing defect is reproducible.
2. **Stale completion (remediated in the reference control plane):** a task is marked orphaned after its original worker stops making progress. The old callback is now ignored unless its generation, token, owner and live lease match the active task.

Positive controls also test duplicate callback deduplication for an unchanged
in-process task, survival of a previously committed snapshot when a temporary
file is truncated, and sequential duplicate operation-key deduplication.

**Warning:** The remaining lost-update negative control describes the legacy JSON store. A green suite does not establish multi-process correctness for that default backend. The opt-in SQLite tests enforce two-writer preservation; the stale-callback test is now a positive invariant, but external execution fencing remains unproven.

## Required transactional design

Before promotion:

- Select a transaction-capable persistence backend with a documented Node
  runtime baseline, cross-process transaction guarantee, and crash recovery.
- Preserve the exported JSON snapshot format as a compatibility interface;
  migrate existing snapshots without silently overwriting historical records.
- Acquire execution/operation identity atomically, before dispatch.
- Tie task completion to the current valid lease generation and fencing token
  using compare-and-swap semantics; stale callbacks must not change state.
- Define how the execution adapter prevents external side effects by obsolete
  owners. A database write lock alone does not fence an already running device
  action or external API call.
- Treat ambiguous post-dispatch failure as indeterminate. Never blindly retry
  non-idempotent mutations.
- Test child process crashes at transaction boundaries and after external
  dispatch, duplicate callbacks across processes, expired lease recovery,
  and orphaned state reconciliation.
- Run old-state import/export and reproducibility tests before switching
  any production or reference default.

## Security and operations boundaries

This lab reproduces races locally and never touches the existing production
Helix/Kali platform, phone, Rish transport, or live credentials. A successful
regression run provides defect evidence only. It is not a proof of
transactional durability, power-loss atomicity, device-level idempotency,
exactly-once execution, or production readiness.

**Current invariant states**

| Contract | Status |
| --- | --- |
| Cross-process no-lost-update | **FAILS** — reproducible legacy defect |
| Stale worker cannot finalize in the reference control plane | SOURCE FIX + OFFLINE TEST, production not verified |
| Single-process repeated callback deduplicated | LOCALLY TESTED, CI required |
| Staging file does not expose partial destination | LOCALLY TESTED, CI required |
| Transactional migration/rollback | Opt-in SQLite import and CAS tests; no production cutover |
| Current-generation callback guard | Implemented for in-memory control-plane callbacks; external sink fencing unproven |
| Power-loss fsync durability | NOT TESTED |
| Real external execution side effects | NOT TESTED |

## Related development

- `test/state-concurrency.test.mjs` — proof harness and positive controls.
- `test/fixtures/file-store-race-worker.mjs` — independent child-process writer.
- `src/store.mjs` — file snapshot implementation.
- `src/control-plane.mjs` — task creation and asynchronous callback updates.
- `src/production/durable-agent-executor.mjs` — operation reservation.
- `AGENTS.md` — protect production, prefer reversible changes.
- Canonical OmniKali graph `OMNIKALI-SYSTEM-KG-2026-10-01` — reference versus production ownership.

## Human decision / safe stopping point

Engineering can continue with an isolated, backward-compatible storage
implementation and unit/integration tests. Any migration of real production
state, rollback that would discard new records, or device execution authority
requires a separately authorized operational decision.
