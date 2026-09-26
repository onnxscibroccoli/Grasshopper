# Production schema recovery status

Status: live schema and migration ledger recovered.

## Recovered production evidence

The live PostgreSQL control-plane database was inspected through an authorized runtime path without exposing credential values or modifying database state.

The live `_helix_migrations` ledger contains, in order:

1. `0001_auth.sql`
2. `0002_workspaces.sql`
3. `0003_stream.sql`
4. `0004_omnikali_tasks.sql`

The live public catalog contains the Better Auth tables, workspace tables, and OmniKali task/event tables. The task schema contains the established durable task identity, target, workspace, payload, idempotency key, state, owner, lease, heartbeat, attempts, result/error, timestamps, and event fields.

The live database confirms the task claim index, idempotency unique index, workspace index, task-event index, workspace foreign key, and task-event foreign key. Migration 0003 is confirmed by the `stream_ticket` and `vnc_port` columns on `workspaces`.

## Migration/source reconciliation

The live migration files exactly match the files at deployed Helix checkout `46ba4b71158a74db5ede97e300099370792ecff8` by SHA-256. The deployed checkout is dirty and therefore remains runtime evidence, not a reproducible release artifact.

The accepted production fix remains Helix commit `38903b021cca75189a99e1ed88b508bae577f048`. The accepted commit is historical acceptance evidence and is not treated as proof of the later deployed checkout contents.

## Privilege finding

The live runtime role is non-superuser but has broader database authority than the intended least-privilege boundary, including CREATE on the public schema, CREATEROLE, CREATEDB, and broad table privileges on the control-plane tables.

This is a hardening finding, not a justification for an immediate production privilege change. Any reduction must be compatibility-tested and followed by normal execution, recovery, migration, and acceptance evidence.

## Gate status

The previous schema-recovery blocker is closed. Reproducible deployment automation must preserve the observed migration ordering and durable state, define rollback/recovery behavior, and prove the clean-host reconstruction path.

See `docs/PRODUCTION_LIVE_EVIDENCE.md`, `docs/PRODUCTION_STATE_AND_MIGRATION.md`, and `docs/AUTHORITATIVE_SOURCE_RECOVERY.md`.
