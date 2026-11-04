# ADR-0001: Generation-bound task completion and operation ownership

**Status:** Proposed / reference implementation on a development branch.  
**Date:** 2026-11-04.  
**Scope:** Grasshopper reference control plane; no production migration or live device authority.  
**Depends on:** [ADR-0002 transactional state](ADR-0002-transactional-state.md).

## Decision drivers

A task can be reconciled as orphaned when its executor loses contact.
The old callback may eventually arrive after that decision. A delayed
completion without a current-ownership check can incorrectly change an
orphaned task to completed. Concurrent create calls also need an atomic
operation-key reservation to avoid double dispatch.

A lock record is not sufficient proof of ownership. Workers require a
distinct operation identity, an owner, a lease expiration, a generation,
and a unique fencing token bound to each execution attempt.

## Proposed reference behavior

A newly reserved task receives these fields when moving to `running`:

| Field | Meaning |
| --- | --- |
| `operation_id` | Stable logical operation identity |
| `owner_id` | Unique control-plane instance identity |
| `generation` | Execution attempt generation, initially 1 |
| `fencing_token` | Unique token bound to this execution attempt |
| `expires_at` | Millisecond lease expiry |
| `lease_status` | `active`, `finalized`, or `expired` |

The callback may record completion **only if** task state is still
`running`, the owner/generation/token match, the lease is `active`,
and the time is before expiration. Reconciliation sets `orphaned` and
expires the prior lease; obsolete callbacks are ignored, not accepted.

Task creation now uses `store.update` to reserve `operationKey`
before calling the executor. With `TransactionalStateStore`, the
reservation is serialized across processes; a duplicate returns the
existing task record and never dispatches a second effect.

## Verification

```sh
node --test test/state-concurrency.test.mjs
node --test test/fencing.test.mjs
npm test
```

The worker harness uses independent Node processes and a persisted
side-effect log. Tests also simulate stale callbacks following
reconciliation, lease expiry, and replacement token/generation changes.

## Boundaries and limitations

- The default legacy JSON store remains non-transactional. It cannot
  provide cross-process single-dispatch guarantees, even after the
  control-plane reservation refactor. SQLite must be explicitly
  selected and migration/recovery validated before relying on that
  property.
- An internal fencing check prevents a stale **database update**.
  It does not prevent a worker that already sent an Android command,
  network request, or payment mutation from completing that external
  side effect. External sinks must also enforce fencing or provide
  observation and explicit outcome reconciliation.
- Generation advancement is not yet exposed as a production recovery
  API. An orphaned mutation is not automatically redispatched.
- A default five-minute reference lease is not proof of suitability for
  long-running production jobs. Renewal, clock behavior, and timeouts
  require design and testing.
- A trusted reconciler/human must explicitly determine whether
  external effects happened before any re-execution.
- Cancellation authority can race with external execution despite a
  pre-dispatch ownership check. Unknown outcomes remain unknown.

These limitations forbid declaring exactly-once execution, full
distributed fencing, or production readiness.

## Alternatives considered

1. Accept late callbacks: simple but incorrect after orphaning.
2. Check task state only: rejects some stale writes but cannot distinguish
   replacement worker generations.
3. Check state, generation, unique token and expiration: stricter internal
   ownership, adopted for the reference implementation.
4. Require device-side monotonic fencing: the stronger end-to-end guarantee
   to design separately, without changing the proven Broccoli/Rish transport.

## Compatibility and operational rollback

Legacy snapshot import/export still uses version-1 state. New lease
fields are additive. Existing completed task records without leases
remain historical records, not proof of a valid new lease.

There is no automatic production cutover. Revert the development
branch through normal review if the contract is rejected. Do not
silently rewrite historical tasks or replay ambiguous external actions.

**Acceptance state:** Source+offline tests pending current-commit CI;
independent review pending; production acceptance not performed.
