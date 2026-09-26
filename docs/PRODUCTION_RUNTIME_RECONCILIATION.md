# Production Runtime Reconciliation

Status: runtime, schema, migration ledger, and privilege evidence recovered; production automation remains fail-closed for clean reconstruction and release reconciliation.

## Scope

This record reconciles the live production host against accepted Helix revision `38903b021cca75189a99e1ed88b508bae577f048`.

No production migration or deployment mutation is authorized by this document.

## 1. Deployed executor

The live gateway host contains:

`/opt/helix/production/gateway/state/agent-executor.mjs`

Observed SHA-256:

`6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e`

The deployed gateway executor is an HTTP adapter. It POSTs the task command, cwd, and timeout to the local authenticated agent bridge at `/execute`.

The accepted Helix revision does not contain `production/gateway/state/agent-executor.mjs`. Repository lookup at the accepted SHA returned no such file. Therefore this artifact is runtime evidence, not an accepted-source artifact.

### Actual execution boundary

The live execution service is:

`omni-agent.service`

It runs:

`/opt/helix/production/agent/omni-agent.mjs`

Observed SHA-256:

`ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d`

The service binds the authenticated local bridge on `127.0.0.1:8093` and executes commands inside VM `helix-omnikali` through libvirt QEMU guest-agent `guest-exec`.

This is the production execution artifact established by runtime inspection. It is not substituted with Grasshopper's reference executor.

## 2. Actually deployed gateway unit

The enabled and active unit is:

`/etc/systemd/system/helix-gateway.service`

Observed effective properties:

- User: root
- WorkingDirectory: /opt/helix
- EnvironmentFile: /etc/helix/gateway.env
- Restart: always
- RestartSec: 3s
- Requires: helix-libvirt-hypervisor.service
- Main process: `/usr/local/sbin/helix-gateway-launcher`

The effective unit has a drop-in:

`/etc/systemd/system/helix-gateway.service.d/10-database-secret.conf`

The drop-in replaces the source unit's ExecStart with the launcher and supplies a secret-manager reference through `HELIX_DB_SECRET_ARN`.

The launcher resolves the database credential at runtime, constructs the protected database connection environment, and then executes the accepted gateway start script. No credential value is recorded here.

The accepted source unit at `38903b021cca75189a99e1ed88b508bae577f048` uses:

`/bin/sh /opt/helix/production/gateway/start-helix-gateway.sh`

directly. Therefore the deployed service lifecycle is a runtime overlay on the accepted source service, not an exact byte-for-byte reproduction of the accepted unit.

## 3. Live source revision

The deployed checkout reports:

`46ba4b71158a74db5ede97e300099370792ecff8`

The checkout is dirty and contains production-local changes and untracked runtime additions. It therefore cannot be treated as an immutable release identifier.

The accepted production fix remains:

`38903b021cca75189a99e1ed88b508bae577f048`

## 4. PostgreSQL production binding

The gateway process has a database connection environment supplied by the launcher. The launcher targets the production RDS PostgreSQL endpoint through a secret-manager-backed credential.

Non-secret runtime evidence also shows the production task schema is active: gateway logs recorded PostgreSQL constraint errors against:

- `public.omnikali_tasks`
- `omnikali_tasks_workspace_id_fkey`

This proves the live database contains the accepted task table and its workspace foreign-key constraint.

The live host also contains:

- `migrations/0001_auth.sql`
- `migrations/0002_workspaces.sql`
- `migrations/0003_stream.sql`
- `migrations/0004_omnikali_tasks.sql`
- `production/database/migrate.mjs`
- `production/gateway/state/schema.sql`

The live `0004_omnikali_tasks.sql` is the migration form of the recovered accepted task schema, including the workspace foreign key and workspace index.

### Applied migration ledger

The migration runner uses `_helix_migrations` with:

- `filename` primary key
- `applied_at` timestamp
- advisory lock `helix:migrations`
- ordered numbered SQL files

The live `_helix_migrations` rows were inspected through an authorized read-only runtime path. The applied files are exactly `0001_auth.sql`, `0002_workspaces.sql`, `0003_stream.sql`, and `0004_omnikali_tasks.sql`, in that order. Their applied timestamps are recorded in `docs/PRODUCTION_LIVE_EVIDENCE.md`.

## 5. Reconciliation result

### Recovered

- deployed gateway service identity
- effective systemd drop-in model
- runtime database secret binding model
- deployed gateway executor adapter
- deployed OmniKali agent executor
- actual Kali VM execution boundary
- complete live PostgreSQL table/column/index/constraint inventory
- exact `_helix_migrations` ledger
- live database identity and observed privileges
- migration runner and migration files
- deployed checkout revision and dirty-state boundary

### Still gated

- exact clean-release lineage from accepted production fix to deployed dirty checkout
- exact deployment-time relationship between local production modifications and the deployed revision
- reproducible reconstruction of the production host from clean source
- automated rollback/recovery execution
- acceptance runner automation for all required failure boundaries

## 6. Automation gate

The schema-recovery blocker is closed. Production migration/deployment automation may now be formalized against observed state, but it must remain fail-closed until the clean release/reconstruction path and rollback evidence are implemented.

Do not run a guessed migration chain against production. The known migration ledger is the baseline that automation must preserve.

A separate hardening finding is recorded: the live `helix` database role is broader than the intended least-privilege boundary. Privilege reduction is a controlled change requiring compatibility and acceptance evidence.
