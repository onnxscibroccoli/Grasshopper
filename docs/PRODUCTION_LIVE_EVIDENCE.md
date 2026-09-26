# Production live evidence

Date: 2026-09-26
Status: database schema and migration ledger recovered through an authorized read-only runtime path.

## Scope

This document records non-secret evidence captured from the live Helix production environment. It does not authorize or perform production mutation.

## AWS production database

Observed in us-east-1:

- RDS instance: `helix-control-plane`
- Engine: PostgreSQL 18.3
- Status: available
- Instance class: db.t3.micro
- Multi-AZ: enabled
- Primary AZ: us-east-1b
- Secondary AZ: us-east-1a
- Publicly accessible: false
- Storage: gp3, 20 GiB allocated, autoscaling to 100 GiB
- Storage encryption: enabled with KMS
- Deletion protection: enabled
- Backup retention: 1 day
- CloudWatch PostgreSQL and upgrade log exports: enabled
- IAM database authentication: disabled
- RDS-managed master secret: active
- Secret rotation: enabled every 7 days
- DB subnet group: two active subnets across us-east-1a/us-east-1b

Observed security group attachment and subnet placement are in the production VPC. No resource IDs, endpoints, passwords, or secret payloads are recorded here.

## Runtime access path

The production gateway host is SSM-managed and online. Its runtime configuration supplies the database secret reference through the active gateway systemd drop-in. The host can resolve the referenced secret under its assigned runtime identity.

The database was queried through an existing PostgreSQL driver already present on the host. No package was installed into the production application, no service was restarted, and no database mutation was performed.

## Applied migration ledger

The live `_helix_migrations` table contains exactly:

| Migration | Applied at (UTC) |
| --- | --- |
| `0001_auth.sql` | 2026-09-26 06:08:39.116 |
| `0002_workspaces.sql` | 2026-09-26 06:08:39.138 |
| `0003_stream.sql` | 2026-09-26 06:08:39.153 |
| `0004_omnikali_tasks.sql` | 2026-09-26 06:08:39.159 |

This establishes that the numbered migration chain is applied in order on the live production database.

## Live public schema

The live database contains:

- `_helix_migrations`
- Better Auth tables: `user`, `session`, `account`, `verification`
- `workspaces`
- `workspace_files`
- `workspace_events`
- `omnikali_tasks`
- `omnikali_task_events`

The task table has the verified durable fields for target, workspace, payload, idempotency key, state, owner, lease expiry, heartbeat, attempts, result/error, and lifecycle timestamps.

The task state constraint is exactly:

`PENDING | RUNNING | COMPLETED | FAILED`

The live task table has:

- unique `idempotency_key`
- claim index on `state, lease_expires_at, created_at`
- workspace index on `workspace_id, created_at DESC`
- primary key on `task_id`
- workspace foreign key with `ON DELETE SET NULL`

The event table has a task foreign key with `ON DELETE CASCADE` and an index on `task_id, created_at DESC`.

Migration 0003 is also confirmed live through the presence of `workspaces.stream_ticket` and `workspaces.vnc_port`.

## Live database identity and privileges

The gateway database identity is the non-superuser role `helix` on database `helix`, PostgreSQL 18.3.

The role has USAGE and CREATE on the public schema. The observed table grants include full DML/control privileges on the task, event, workspace, and migration tables. The role also has `CREATEROLE` and `CREATEDB` while remaining non-superuser.

This is a hardening finding: the observed runtime database role is broader than the intended least-privilege boundary. Do not silently change it. Any privilege reduction must document compatibility impact and be followed by database connectivity, migration, normal execution, recovery, and acceptance evidence.

## Deployed source reconciliation

The deployed checkout reports revision:

`46ba4b71158a74db5ede97e300099370792ecff8`

The checkout is dirty and contains production-local modifications and runtime additions. It is therefore not a reproducible release artifact by itself.

The live migration files exactly match the files stored at that deployed checkout revision by SHA-256:

| File | SHA-256 |
| --- | --- |
| `0001_auth.sql` | `f953cacc448c0c81ae4fe63e66b0e59569e840782ad279fdee201dff529363e9` |
| `0002_workspaces.sql` | `eb343cfe1df2a8e66a619b2210d65f0e18963533180054ad72b261b98c12f1a2` |
| `0003_stream.sql` | `90d2ef6df1283449ba52cbc327e76d7d834abb13afb7f3a2473ad15726755a03` |
| `0004_omnikali_tasks.sql` | `6fb6375a598ce4cc31a6e19150b7bdd187b21a6289e167dc136ce28508d8f75e` |

Accepted production fix commit remains `38903b021cca75189a99e1ed88b508bae577f048`. The deployed checkout is a later, dirty runtime state and must not be treated as an immutable replacement for the accepted source.

## Production execution artifacts

Observed live artifacts remain:

- gateway executor adapter SHA-256: `6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e`
- OmniKali execution bridge SHA-256: `ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d`

The execution bridge invokes QEMU guest-agent execution inside the verified Kali VM. These runtime artifacts remain distinct from Grasshopper's reference executor.

## Automation conclusion

The production database schema and migration ledger are no longer an unknown. They are now directly reconciled evidence.

The remaining reproducibility gates are source/runtime release reconciliation, clean-host reconstruction, exact IAM/service definitions, readiness/acceptance automation, rollback automation, and executor hardening. Production migration automation may now be designed against observed schema state, but it must still be fail-closed and must not mutate production until the clean reconstruction path and rollback evidence are established.
