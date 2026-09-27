# Production reconstruction status

Target: authenticated gateway -> provider-neutral PostgreSQL -> worker -> Kali.

Execution guarantee: command-type-specific; never universal exactly-once.

Required implementation sequence:
1. infrastructure
2. IAM
3. secrets
4. database migrations
5. service lifecycle
6. readiness
7. acceptance
8. rollback/recovery
9. telemetry

An artifact is complete only when an authorized automation agent can reproduce its result from canonical source and explicit prerequisites without undocumented human intervention.

## Current formalization state

The repository now has:

- machine-verifiable production deployment-input boundary;
- HTTPS readiness gate;
- state/migration contract;
- gateway/worker service-lifecycle contract;
- reconstruction manifest;
- exact recovered OmniKali agent bridge fingerprint;
- byte-for-byte verification of the recovered bridge against the production host;
- production agent artifact credential scan;
- explicit secret-reference deployment boundary;
- formal agent bridge execution-guarantee hardening contract;
- canonical source copy of the recovered bridge;
- machine-verifiable canonical-source fingerprint gate.

Production mutation remains fail-closed.

## Observed production boundary (2026-09-27)

The authenticated Helix gateway -> PostgreSQL -> worker -> Kali path was previously accepted. This is acceptance of the observed runtime path, not proof that the whole host can be reconstructed from a clean Git checkout.

A dedicated backup EC2 instance exists with its scheduler timer active. An encrypted, versioned S3 backup bucket exists, the age recovery secret has an `AWSCURRENT` version, and a public age recipient is installed on the runner host. At the time of observation the bucket held **zero backup objects**. The backup service failed because `/usr/local/lib/independent-backup-policy.mjs` was absent. A TLS-related runner patch had been applied on the host, but the checked-in runner and that host state have not been reconciled into a verified release. An active timer, provisioned bucket, current secret, or installed recipient does not establish a successful backup or restore.

The repository contains `lib/independent-backup-policy.mjs`, imported by `scripts/independent-postgres-backup.mjs` through a relative path. Source-to-host deployment must preserve that relationship or install a reviewed package with an equivalent verified import path; copying the runner script alone to `/usr/local` does not reproduce its dependency. The exact host service and deployment packaging must be captured and tested before claiming a reproducible backup service. See [INDEPENDENT_POSTGRES_BACKUP_RUNNER.md](./INDEPENDENT_POSTGRES_BACKUP_RUNNER.md) for the staged recovery order.

## Source recovery result

The authoritative application repository is onnxscibroccoli/helix, and the accepted gateway-startup worker fix is commit 38903b021cca75189a99e1ed88b508bae577f048.

The observed deployed checkout is 46ba4b71158a74db5ede97e300099370792ecff8 and is dirty. It cannot be treated as an immutable release identifier.

The live production PostgreSQL schema and _helix_migrations ledger have been directly recovered. The numbered chain is applied in order through 0004_omnikali_tasks.sql, and the live catalog matches the established task/workspace contract. The schema-recovery gate is closed.

The accepted Helix revision's migration files have also been recovered as evidence copies under reference/production/helix-accepted/migrations/. Their clean-source content is not assumed to be byte-identical to the live deployed migration artifacts. The live SHA-256 evidence differs, so clean source/runtime lineage remains an explicit gate.

## Agent bridge source designation

The exact recovered bridge is now promoted to the Grasshopper canonical source path:

src/production/omni-agent.mjs

The canonical source is intentionally byte-identical to:

reference/production/deployed/omni-agent.mjs

and to the recovered production artifact:

/opt/helix/production/agent/omni-agent.mjs

Canonical and evidence SHA-256:

ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d

This designation formalizes source ownership without changing the production deployment or adding runtime behavior.

The bridge remains the proven QEMU execution primitive. Hardening must be layered around it rather than replaced with a different executor.

## Executor adapter source designation

The recovered production executor adapter is now also promoted to the canonical source path:

src/production/agent-executor.mjs

It remains byte-identical to reference/production/deployed/agent-executor.mjs and preserves the validated adapter behavior. This adapter is a transport boundary, not executor-side exactly-once enforcement.

The full control-plane and executor hardening contract remains command-type-specific.

## Secret boundary

The source references AGENT_TOKEN only through runtime environment configuration.

Deployment automation may carry OMNIKALI_AGENT_SECRET_ID or OMNIKALI_AGENT_SECRET_ARN as a reference. It must never carry AGENT_TOKEN or another secret payload.

Production currently still uses the existing protected host environment configuration. Migration to secret-manager-backed injection remains a controlled production change requiring credential rotation and full acceptance.

## Remaining reconstruction gates

- clean source/release lineage for the full deployed Helix stack;
- deterministic clean-host reconstruction;
- secret-manager-backed agent credential injection and controlled rotation;
- readiness and acceptance automation;
- rollback/recovery automation;
- executor-side idempotency/cancellation controls appropriate to command type;
- controlled least-privilege reduction;
- backup/PITR hardening.

For the independent backup path, additionally establish a clean source package with all runtime imports and TLS behavior reconciled against the host; a reviewed installation and systemd definition; one successful scheduled backup with encrypted artifact and manifest in S3; an isolated decrypt/restore and application acceptance; and the required retained recovery-point history. These gates are open as of the observation above. Native RDS automated-backup retention remains 1 day; independent logical recovery does not change its PITR setting.

A live privilege hardening finding is recorded: the helix database role is non-superuser but broader than the intended least-privilege boundary. This requires controlled compatibility testing, not an ad hoc production edit.

See docs/PRODUCTION_SOURCE_LINEAGE_RECONCILIATION.md, docs/PRODUCTION_LIVE_EVIDENCE.md, docs/PRODUCTION_RUNTIME_RECONCILIATION.md, docs/PRODUCTION_AGENT_BRIDGE_RECOVERY.md, and docs/PRODUCTION_AGENT_BRIDGE_HARDENING.md.
