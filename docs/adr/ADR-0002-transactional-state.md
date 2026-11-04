# ADR-0002: Transactional state storage for the reference control plane

**Decision status:** Proposed — compatibility implementation exists on a development branch; not selected as a production default.  
**Decision date:** 2026-11-04.  
**Owner:** Grasshopper reference control-plane maintainers.  
**Related:** [Concurrency baseline](../architecture/CONTROL_PLANE_CONCURRENCY_BASELINE.md), `src/store.mjs`, `src/transactional-state-store.mjs`, `test/transactional-state-store.test.mjs`.

## Context

The legacy `StateStore` writes a JSON snapshot to a process-specific temporary path and renames it into place. Atomic replacement prevents a half-written destination from being observed, but does not make independent process read/modify/save operations a transaction. The negative-control tests reproduce lost updates. Task lifecycle callbacks separately lack generation-based fencing.

## Proposed decision

Introduce an **opt-in** `TransactionalStateStore` with SQLite WAL mode, a single snapshot row, serialized `BEGIN IMMEDIATE` updates, a revision counter, compare-and-swap protection on the legacy `load → save` shape, and `synchronous=FULL` for a stronger local power-loss boundary.

Use the documented `node:sqlite` module from Node.js >=22.16 without adding a native npm dependency. **Node 22 exposes this module as experimental**; switching the default or claiming support on Node 20 requires explicit portability and version-policy decisions. The adapter is an evaluation implementation, not yet a production-grade storage choice.

Any update callback returning a promise fails the transaction. This prevents an asynchronous continuation from being mistaken for part of a synchronous SQLite write transaction. Do not run external API calls or Android actions while holding a write lock.

Legacy migration is explicit and import-only. It rejects importing onto an occupied SQLite database and leaves the original JSON file untouched. Before a real cutover, quiesce legacy writers, secure a backup, verify its digest, migrate once, and compare the full exported state and event history.

## Alternatives

1. Keep the JSON snapshot store: simplest but loses concurrent updates and has incomplete power-loss guarantees.
2. Implement advisory filesystem locks: adds stale-lock/reclamation races, filesystem assumptions, and complex recovery.
3. SQLite WAL: existing, widely documented transaction model with a small deployment footprint; synchronous calls block the Node event loop and portability needs validation.
4. External PostgreSQL: suits higher-scale distributed nodes but adds provisioning, credentials, network and operational dependencies to an offline reference environment.

## Engineering requirements before acceptance

- Demonstrate cross-process no-lost-update and independent-process crash recovery.
- Protect `ControlPlane.createTask` against duplicate dispatch through atomic operation reservation, not only an atomic store adapter.
- Introduce execution lease `owner_id`, generation, fencing token and expiration; only the current generation may finalize.
- Make stale callbacks fail closed, and preserve `OUTCOME_UNKNOWN` for dispatched actions whose external results cannot be proven.
- Verify replay of legacy snapshots and migration rollback without deleting historical evidence.
- Characterize SQLite connection lifecycle, busy-timeout behavior, WAL checkpointing and disk-full outcomes.
- Decide and pin a supported Node major/minor combination and OS/filesystem matrix.
- Re-run the complete repository test, BIST, control-plane reproducibility, and integration evidence on the exact PR SHA.
- Preserve production Helix/Kali ownership and do not migrate deployed data without separate authorization.

## How to reproduce the experiment

```sh
node --test test/transactional-state-store.test.mjs
node --test test/state-concurrency.test.mjs
npm test
```

The first command checks the new backend's transaction and import behavior.
The second continues to reproduce the **legacy** defects as explicitly named
negative controls. Neither by itself establishes a production cutover.

## Limitations and rollback

The default `src/store.mjs` is unchanged. Current operational paths continue
to use the existing JSON contract. Rollback is deletion/revert of the opt-in
adapter and its tests through a normal reviewed PR; there is no automatically
reversible SQLite-to-JSON migration. Never silently downgrade or drop newly
committed records. The existence of a passing SQLite test does not establish
cross-process executor ownership, device-side fencing, or regulatory acceptance.

**Current state:** Experimental; offline CI verification pending; independent review pending; no production validation.
