# Production Task State Contract

Status: authoritative source recovered from the accepted production application revision.

## Source

Canonical application repository: `onnxscibroccoli/helix`

Accepted production fix revision:

`38903b021cca75189a99e1ed88b508bae577f048`

Authoritative files recovered from that revision:

- `production/gateway/helix-gateway.mjs`
- `production/gateway/state/task-state.mjs`
- `production/gateway/state/task-runner.mjs`
- `production/gateway/state/task-dispatch.mjs`
- `production/gateway/state/task-worker.mjs`
- `production/gateway/state/schema.sql`

This document formalizes the recovered contract. It does not replace the deployed implementation.

## Durable state

The production task lifecycle is:

`PENDING -> RUNNING -> COMPLETED | FAILED`

A task contains:

- UUID task identity
- target
- optional workspace identity
- JSON payload
- unique idempotency key
- state
- owner identity
- lease expiry
- heartbeat timestamp
- attempt count
- result or error
- created, started, completed, and updated timestamps

Task events are durable and record state transitions, owner identity, detail, and creation time.

## Ownership and recovery

Claiming is performed inside a PostgreSQL transaction using row locking with `FOR UPDATE SKIP LOCKED`.

A worker may claim:

- a `PENDING` task, or
- a `RUNNING` task whose lease has expired.

A claim changes the task to `RUNNING`, assigns the worker owner, increments attempts, records heartbeat/start information, and establishes a new lease.

Heartbeats are accepted only for the current owner while the task is `RUNNING`.

Completion and failure are fenced by owner identity. A worker that no longer owns the task cannot authoritatively finish it.

Expired leases are reconciled back to `PENDING` with the owner and lease cleared, and a durable event records the recovery.

This is the verified control-plane recovery mechanism. It is not a claim of universal exactly-once external side effects.

## Idempotency

`idempotency_key` is unique at the PostgreSQL layer.

A repeated submission with the same key returns the existing task only when target, workspace, and payload match. A conflicting reuse of the key is rejected.

This establishes durable task submission idempotency. It does not by itself make arbitrary external commands exactly-once.

## State schema dependency

The recovered task schema references the existing `workspaces(id)` relation. Grasshopper does not invent or recreate that relation here.

The exact recovered SQL is preserved separately as a source snapshot at:

`reference/production/omnikali-task-schema.sql`

That snapshot is evidence for implementation and migration formalization. It is not yet declared a complete production migration because the authoritative deployed schema for referenced relations and the applied migration history must still be reconciled.

## Remaining source-recovery gate

Recovered:

- accepted application revision
- gateway task-control initialization
- task persistence contract
- lease/heartbeat/reclaim semantics
- owner fencing
- task event model
- submission idempotency contract

Still requiring authoritative evidence before deployment automation claims completeness:

- exact deployed executor implementation
- exact deployed service-unit/lifecycle definitions
- complete authoritative PostgreSQL schema including referenced relations
- applied migration inventory on the production database
- exact runtime configuration binding

No credentials, session cookies, tokens, private keys, or credential-bearing database URLs belong in this contract or its artifacts.
