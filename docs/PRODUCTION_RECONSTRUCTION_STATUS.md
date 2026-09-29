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

A dedicated backup EC2 instance exists with its scheduler timer active. An encrypted, versioned S3 backup bucket exists, the age recovery secret has an `AWSCURRENT` version, and a public age recipient is installed on the runner host. Earlier failures included an absent `/usr/local/lib/independent-backup-policy.mjs` and a retry that exited 1 with zero S3 objects. The module was installed with its hash verified, a TLS fix and `create` wrapper argument were installed, and a dedicated `helix_backup` PostgreSQL role was provisioned with read-only grants. At **2026-09-27 02:42 UTC**, the service exited 0 and its first encrypted `.age` artifact (5,185 bytes) and JSON manifest (561 bytes) appeared in S3.

That backup was subsequently age-decrypted, zstd-decompressed, and restored with `pg_restore --no-owner --no-acl --exit-on-error` (exit 0) into an isolated, Unix-socket-only PostgreSQL 17 cluster on the Kali host. Database checks found migrations `0001` through `0004`, two `COMPLETED` tasks, seven task events, zero orphan events, and zero leases without an owner. The temporary plaintext and cluster on tmpfs were removed, as were the temporary IAM grants. This is **database-level restore evidence for one recovery point**. An authenticated Helix gateway/worker task against the restored database and fourteen-day independent coverage remain unproven.

The repository contains `lib/independent-backup-policy.mjs`, imported by `scripts/independent-postgres-backup.mjs` through a relative path. Source-to-host deployment must preserve that relationship or install a reviewed package with an equivalent verified import path; copying the runner script alone to `/usr/local` did not reproduce its dependency. The installed repairs and wrapper behavior still need clean-source reconciliation and repeatable installation before claiming a reproducible backup service. See [INDEPENDENT_POSTGRES_BACKUP_RUNNER.md](./INDEPENDENT_POSTGRES_BACKUP_RUNNER.md) for the staged recovery order.

## Clean-checkout runtime proof (2026-09-29)

A fresh GitHub Actions checkout of Helix was used to close the repository-side runtime test gap without mutating production.

- Helix merge commit: `08aa51797b0bf5a42cb41e3aa6f44e45ce82d514`.
- Production-validation run: `36626665726` — completed successfully.
- Validation harness run: `36626665460` — completed successfully.
- Terraform formatting/init/validation passed.
- Python validation suite passed.
- `npm ci --ignore-scripts` passed from the clean checkout.
- `npm test` passed from the clean checkout after correcting test isolation defects exposed by this gate.
- ShellCheck passed for the production shell entrypoints.

The first clean runtime run deliberately failed at `npm test`: nine existing Node tests inherited the repository's real `src/lib/og/site.json` and `public/og.jpg`, and one migration test incorrectly treated the entire migrations directory as empty. Those tests were corrected to isolate fixture behavior and to model the auth migration directory correctly. No production implementation was weakened or bypassed.

This closes the **repository-side clean-checkout runtime test gate**. It does **not** close the live clean-host reconstruction gate, live secrets re-verification, or full AWS/hypervisor reconstruction. Those still require live evidence from an authorized disposable environment.

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

Production agent bridge credentials use an AWS Secrets Manager reference, not a static `AGENT_TOKEN` in host environment files.

- Secret id (reference only): `omnikali/production/agent-bridge-token`
- Runtime loader: `src/production/agent-secret.mjs` via `HELIX_AGENT_TOKEN_SECRET_ID`
- Recorded systemd drop-ins: `reference/production/deployed/*/20-agent-secret.conf`
- Deployment automation must carry only secret references (`HELIX_AGENT_TOKEN_SECRET_ID` and/or `OMNIKALI_AGENT_SECRET_ID`), never `AGENT_TOKEN` payloads

Repository contract evidence (loader, drop-ins, contract/migration docs, and unit tests) is present on this branch. PR #16 recorded the Secrets Manager migration path and production verification notes in [AGENT_SECRET_MIGRATION.md](./operations/AGENT_SECRET_MIGRATION.md); PR #18 added the artifact gate that rejects static `AGENT_TOKEN` and requires the Secrets Manager loader.

**This status update does not rotate, delete, or recreate credentials, and it does not re-verify the live host in this change.** Distinguishing repository contract from live cutover:

- **Repository secrets-injection contract** — closed from repo evidence (loader + drop-ins + docs + tests).
- **Live production secrets cutover re-verification** — remains open until an authorized operator re-confirms the live host still loads `HELIX_AGENT_TOKEN_SECRET_ID` (or equivalent) from Secrets Manager. Do not treat this document edit as fresh live acceptance. Operator checklist: [PRODUCTION_SECRETS_CUTOVER_REVERIFY.md](./operations/PRODUCTION_SECRETS_CUTOVER_REVERIFY.md).
- **Future controlled credential rotation** — still a separate production change requiring a recovery plan and human confirmation; it is not implied by closing the repository contract gate.

## Remaining reconstruction gates

- clean source/release lineage for the full deployed Helix stack;
- deterministic clean-host reconstruction;
- live production secrets cutover re-verification (host still loads Secrets Manager reference; not re-verified by this doc edit) and future controlled credential rotation;
- readiness and acceptance automation;
- rollback/recovery automation;
- executor-side idempotency/cancellation controls appropriate to command type;
- controlled least-privilege reduction;
- backup/PITR hardening.

For the independent backup path, additionally establish a clean source package with all runtime imports and TLS behavior reconciled against the host; a reviewed installation and systemd definition; repeatable scheduled backups; independent verification of the uploaded artifact and manifest; authenticated application acceptance against the restored database; and the required retained recovery-point history. The first upload and database-level restore are observed; the remaining gates are open. Native RDS automated-backup retention remains 1 day; independent logical recovery does not change its PITR setting.

A live privilege hardening finding is recorded: the helix database role is non-superuser but broader than the intended least-privilege boundary. This requires controlled compatibility testing, not an ad hoc production edit.

See docs/PRODUCTION_SOURCE_LINEAGE_RECONCILIATION.md, docs/PRODUCTION_LIVE_EVIDENCE.md, docs/PRODUCTION_RUNTIME_RECONCILIATION.md, docs/PRODUCTION_AGENT_BRIDGE_RECOVERY.md, and docs/PRODUCTION_AGENT_BRIDGE_HARDENING.md.
