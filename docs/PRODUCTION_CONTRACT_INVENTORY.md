# Production contract inventory (2026-09-27 UTC)

This inventory distinguishes observations on the running Kali host from historical acceptance evidence and the separate Grasshopper reference implementation. It is not a production deployment recipe.

## Observed on the Kali host

- AWS STS identified the instance session as `HelixKaliDesktopRole` on the production EC2 instance.
- The authenticated gateway, XFCE desktop, VNC/noVNC bridge, EBS volume agent, libvirt reconciler, remote agent bridge, and MCP service were active according to `systemctl list-units`. Service activity does not establish end-to-end task health.
- The live Helix checkout is `/opt/helix`, on branch `omnikali/production-db-bootstrap-20260926` at `46ba4b7`, with tracked modifications and untracked files. Do not deploy or reset it from this inventory.
- The clean Grasshopper checkout is `/opt/omnikali-reference`, on `main` at `958bc47` before this documentation branch.

## Secret access boundary

The actual Secrets Manager name is `omnikali/production/backup-age-identity`; the six-character suffix belongs to its ARN. A prior query for names beginning with `omnikali/production/backup-age-identity-` returned no match because the name has no trailing dash. The earlier malformed JMESPath expression with a dangling pipe also cannot establish IAM denial.

On 2026-09-27 an inline policy named `OmniKaliBackupAgeRecoverySecret` was added to `HelixKaliDesktopRole`. It allows `secretsmanager:DescribeSecret` and `secretsmanager:GetSecretValue` only on the exact existing backup-age identity ARN. The role's other pre-existing policies separately allow access to the agent bridge and control-plane database secrets, so the entire EC2 role is **not** limited to the backup-age secret.

Verification from the Kali instance:

| Check | Result |
| --- | --- |
| STS caller identity | Assumed `HelixKaliDesktopRole` |
| `ListSecrets` | Access denied |
| `DescribeSecret` for backup-age identity | Allowed; metadata only |
| `DescribeSecret` for separate PostgreSQL backup secret | Access denied |
| `GetSecretValue` for backup-age identity | IAM simulation allowed; a value-suppressed host call returned `ResourceNotFoundException` because the secret currently has no version staged as `AWSCURRENT` |
| IAM simulation for separate PostgreSQL backup secret | `DescribeSecret` and `GetSecretValue` both implicitly denied |

The secret metadata has no `VersionIdsToStages`, so a working credential read has not been demonstrated. The backup runner's own identity and isolation have not been established. No OmniKali/Helix backup service or timer appeared in the systemd service/timer name inventory. Before asserting that a runner cannot access unrelated secrets, identify its process principal and test that principal's effective policy. If it inherits this instance role, it inherits the role's other existing secret permissions. Do not claim runner isolation from the one denied metadata probe.

## Production and reference contracts

The handoff records a production gateway → PostgreSQL → worker → Kali execution path, `PENDING → RUNNING → COMPLETED | FAILED`, lease reclamation, gateway startup worker initialization, and historical normal/recovery acceptance in Grasshopper PR #1. Those are historical acceptance claims, not re-run as part of this inventory. The handoff correctly limits duplicate-side-effect evidence to a fenced control plane plus executor-specific idempotency; generic commands do not gain universal exactly-once side effects.

This repository's current local reference uses an atomic JSON state store and deterministic `ok:` / `fail:` executor. It does not deploy or replace the PostgreSQL production path. Its tests exercise reference state transitions, not authenticated production requests or real Kali execution.

## Next reproducibility gate

Inventory the actual gateway routes, database migrations, service unit files, credential prerequisites, backup runner principal, and worker launch/reconciliation settings without printing secret values. Build a separate source-controlled production bootstrap and acceptance path preserving the existing PostgreSQL task/lease schema; keep the JSON reference explicitly scoped to local contract tests. A deployable recipe needs ordered migrations, IAM and Secret Manager prerequisites, readiness probes, failure-injection checks, rollback, and a verified source-to-host reconstruction.
