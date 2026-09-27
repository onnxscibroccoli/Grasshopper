# Agentic reconciliation record - 2026-09-27

## Scope

This record captures live, authorized reconciliation performed after the Grasshopper production acceptance gate. It records observed infrastructure state and a controlled backup execution without weakening any fail-closed gate.

## RDS retention

The production PostgreSQL instance `helix-control-plane` was queried in `us-east-1`.

Observed configuration:

- status: `available`
- engine: PostgreSQL 18.3
- Multi-AZ: enabled
- storage encryption: enabled
- publicly accessible: false
- deletion protection: enabled
- backup retention: **1 day**

A controlled attempt was made to set `BackupRetentionPeriod=14` with `ApplyImmediately=true`.

AWS rejected the mutation with:

```
FreeTierRestrictionError:
The specified backup retention period exceeds the maximum available to free tier customers.
```

The retention gate therefore remains OPEN. The implementation must not claim 14-day RDS PITR until the account restriction is removed and the setting is independently verified.

## Independent backup runner

The dedicated backup runner is:

- instance: `i-043fc2bc49fca1edf`
- role/profile: `OmniKaliIndependentBackupRunnerProfile`
- hostname: `ip-172-31-6-58.ec2.internal`

Read-only SSM inspection confirmed:

- `omnikali-postgres-backup.timer` enabled
- `omnikali-backup-health.timer` enabled
- `omnikali-postgres-backup.service` installed
- `/usr/local/bin/independent-postgres-backup.mjs` present
- `/usr/local/lib/independent-backup-policy.mjs` present
- policy SHA-256: `7759479e79e13711fbc19b24493cf4fbf1043a3c14337748b19b091c5877bdc0`

A controlled service execution completed successfully at approximately 19:37 UTC.

Result:

- backup id: `helix-control-plane-2026-09-27T19-37-06-279Z-83a9bf24-4a8b-44ec-9bf8-df7f13e8f9e3.dump.zst.age`
- artifact SHA-256: `ceb1b363463834cced28fcbfd958dc151e4b361bfd0bc9a5d54dde5f59c087bb`
- artifact size: 5188 bytes
- service exit: 0

This establishes another successful encrypted backup artifact. It does **not** by itself establish another independently restored recovery point.

## Historical runner failures observed during the same journal inspection

The runner journal contained earlier failures from the same day:

1. missing `/usr/local/lib/independent-backup-policy.mjs`;
2. wrapper invocation without the required `create` argument;
3. `helix_backup` password authentication failure;
4. subsequent successful backup at 02:42 UTC;
5. subsequent successful controlled backup at 19:37 UTC.

The current service path is therefore operational, while clean-source reconciliation and repeatable installation remain separate reproducibility work.

## Gate interpretation

No readiness gate is closed by this record.

In particular:

- RDS 14-day retention: OPEN
- 14 independently restored recovery points: OPEN
- clean source-to-host reconciliation: OPEN until source and installed runtime are reconciled
- live acceptance: unchanged
- production secret cutover re-verification: unchanged

This record contains no credentials, tokens, cookies, private keys, or connection strings.
