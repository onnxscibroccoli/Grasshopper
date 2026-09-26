# Independent PostgreSQL backup and 14-day recovery design

## Purpose

This document defines an independent backup mechanism for the verified Helix PostgreSQL control-plane database.

It is intentionally not presented as a modification to Amazon RDS automated-backup retention.

The current production RDS instance has a one-day AWS automated-backup retention period because the account is subject to an AWS Free Tier restriction that rejected the attempted 14-day configuration.

The independent backup mechanism provides a separate recovery path with at least fourteen days of retained logical database backups.

## Critical architectural boundary

The RDS database is a managed AWS service. A libvirt/QEMU hypervisor on an EC2 host does not own the RDS storage layer and therefore cannot take a hypervisor block snapshot of the RDS volume.

The correct architecture is:

    RDS PostgreSQL
        |
        | authenticated PostgreSQL connection
        v
    Backup runner
        |
        +-- logical dump / schema + data
        |
        +-- compression
        |
        +-- encryption
        |
        +-- integrity manifest
        v
    Independent backup repository/storage

A hypervisor may host the backup runner, but its VM snapshot protects the backup runner itself. It does not snapshot RDS.

## Recommended backup layers

Use two distinct layers.

### Layer A: AWS-native RDS protection

Keep the existing RDS automated backups and manual snapshots.

When AWS permits the account-level change, set RDS backup retention to fourteen days and verify the resulting live configuration.

Until then, treat the one-day RDS retention as the actual AWS-native PITR window.

### Layer B: independent logical backups

Run a scheduled PostgreSQL logical backup from a hardened compute environment.

For example:

    PostgreSQL/RDS
        |
        | TLS + least-privilege backup role
        v
    backup-runner VM
        |
        +-- pg_dump --format=custom
        |
        +-- zstd compression when useful
        |
        +-- age or equivalent public-key encryption
        |
        +-- SHA-256 manifest
        v
    object storage / controlled GitHub artifact distribution

The backup runner must never require or store the RDS master password in source control.

Prefer IAM/Secrets Manager-backed retrieval of the database credential or a dedicated PostgreSQL backup identity.

## Why GitHub is not the primary database backup store

GitHub is source control, not database backup infrastructure.

GitHub blocks individual files larger than 100 MiB, recommends keeping repositories small, and specifically warns that Git is not designed for large SQL files. Git LFS changes the mechanics but does not turn a Git repository into a database recovery service. citeturn0search0turn0search8

Therefore the preferred durable design is:

    RDS
      |
      v
    encrypted logical backup
      |
      +--> primary independent object storage
      |
      +--> optional GitHub release/artifact/manifests

If GitHub is required for reproducibility, put the backup metadata, manifest, restore scripts, checksums, schema version, and encrypted chunk references in the repository. Do not place raw production database contents in ordinary Git history.

For small test databases, encrypted backup files can be attached to GitHub releases or tracked with an appropriate large-file mechanism, subject to GitHub limits.

## Snapshot versus logical backup

A PostgreSQL logical backup is not equivalent to an RDS physical snapshot.

An RDS snapshot can preserve the managed database storage state.

A logical dump preserves PostgreSQL objects and data.

Consequences:

- logical backups can be restored into another PostgreSQL instance;
- logical backups can be independently retained outside RDS;
- logical backups do not provide arbitrary point-in-time recovery between dump times;
- a logical backup does not prove that the original RDS instance had fourteen days of AWS automated backups;
- restore testing is required to establish that the independent backup is actually usable.

AWS also provides RDS snapshot export to S3. AWS performs that export from the snapshot and writes compressed, consistent Parquet data to S3. Exported snapshot data is intended for analysis and is not itself directly restorable as an RDS instance, so it should not be confused with a portable database snapshot. citeturn0search1turn0search4

## Backup workflow

### 1. Establish the backup identity

Create a dedicated PostgreSQL role with only the privileges required by the chosen dump method.

Do not use the application's write credentials.

Retrieve credentials at runtime from the existing secret boundary.

### 2. Start a backup

The scheduler invokes the backup runner.

The runner records:

- backup ID;
- database identifier;
- UTC start time;
- source PostgreSQL version;
- schema/application migration revision;
- backup format;
- encryption key identifier;
- output object names;
- SHA-256 checksums.

No password, session cookie, bearer token, or secret value is written to the manifest.

### 3. Produce the logical dump

For a portable PostgreSQL backup, use pg_dump in custom format.

Conceptually:

    pg_dump       --format=custom       --no-owner       --no-acl       "$DATABASE_URL"       > database.dump

Do not put a credential-bearing DATABASE_URL in a command history, Git repository, CI log, or normal process listing.

The implementation should inject connection credentials through a protected runtime mechanism.

### 4. Compress

Compress the dump with zstd when it materially reduces transfer/storage size.

For example:

    zstd --ultra -19 database.dump -o database.dump.zst

The compression level should be selected based on measured backup time and CPU cost, not assumed to be optimal.

### 5. Encrypt

Encrypt before leaving the controlled backup environment.

Use a public-key encryption design so the backup job only needs the encryption public key. Keep the decryption private key outside the backup runner.

Conceptually:

    plaintext dump
        |
        v
    compression
        |
        v
    authenticated encryption
        |
        v
    encrypted artifact

Never commit the decryption key.

### 6. Generate the manifest

Create a manifest containing only non-secret metadata.

Example:

    backup_id
    created_at
    source_instance
    postgres_version
    migration_revision
    artifact_sha256
    artifact_size
    compression
    encryption_key_id
    restore_test_status

The manifest is signed if a signing key is available.

### 7. Offload

Primary destination should be independent object storage with explicit lifecycle retention.

If GitHub is required, publish only encrypted artifacts that comply with GitHub size limits, preferably as release assets or appropriately managed large-file objects. GitHub's documented hard single-object limit is 100 MiB and its repository guidance recommends keeping repositories small. citeturn0search0turn0search8

Never push plaintext production database dumps.

### 8. Retention

The backup scheduler must retain at least fourteen distinct recovery points.

A simple policy is:

    daily backups
    retain >= 14 days
    keep one additional weekly/monthly checkpoint as operationally useful

The retention clock must be based on the backup artifact timestamp, not Git commit history.

### 9. Garbage collection

Delete an artifact only when:

    current_time - backup_timestamp > retention_window

and at least the required number of independently restorable recovery points remain.

Deletion must be auditable.

## Hypervisor role

If the backup runner is itself a VM, the hypervisor provides a second recovery layer:

    EC2
      |
      +-- QEMU/libvirt
           |
           +-- backup-runner VM
                |
                +-- PostgreSQL logical backup
                +-- encryption
                +-- offload

A VM snapshot may protect the backup runner's operating system, scheduler, configuration, and temporary state.

It must not be represented as an RDS snapshot.

Do not mount or attempt to snapshot RDS's underlying storage from the EC2 hypervisor.

## GitHub repository layout

Recommended repository structure:

    backup/
      README.md
      manifests/
        YYYY-MM-DD.json
      restore/
        restore.sh
        verify.sh
      schemas/
        manifest.schema.json
      tooling/
        create-backup.sh
        verify-backup.sh
        retention-check.sh

Encrypted database artifacts should be kept out of ordinary Git history unless their size and retention model are explicitly appropriate.

A manifest can reference an external object:

    {
      "backupId": "2026-09-26T020000Z",
      "source": "helix-control-plane",
      "postgresVersion": "17",
      "migrationRevision": "....",
      "sha256": "....",
      "encryptedObject": "s3://independent-backups/helix/....",
      "retentionUntil": "2026-10-10T020000Z",
      "restoreTest": "passed"
    }

No secret values belong in this document or manifest.

## Fourteen-day verification procedure

The requirement must be interpreted correctly.

There are two separate acceptance claims:

### Claim A: AWS-native PITR retention

This requires the live RDS setting itself to report at least fourteen days.

The current production environment does not satisfy Claim A.

It remains blocked by the account-level AWS Free Tier restriction.

### Claim B: independent fourteen-day recovery coverage

This can be established by the independent backup system.

Test it as follows.

#### Test 1: create recovery points

Run the backup process at least once per scheduled interval.

For a real acceptance test, create fourteen dated recovery points or use a controlled accelerated test clock where the retention implementation explicitly supports it.

Record every artifact in the manifest.

#### Test 2: verify integrity

For every recovery point:

    recompute SHA-256
    verify encryption metadata
    verify manifest signature when enabled
    verify object exists
    verify object size is non-zero

Any failed integrity check fails the acceptance.

#### Test 3: restore

Provision an isolated PostgreSQL test instance.

Decrypt and decompress one backup.

Restore it into the isolated instance.

Run:

    schema verification
    migration compatibility verification
    row-count checks for critical tables
    task/state/lease consistency checks
    application smoke tests

Never restore a test backup directly over production.

#### Test 4: oldest-retained-point test

Select the recovery point whose timestamp is approximately fourteen days old.

Restore that point into an isolated PostgreSQL instance.

Successful restoration demonstrates fourteen-day independent backup coverage.

#### Test 5: application acceptance

Point a temporary Helix gateway/worker test environment at the restored database.

Verify:

    authenticated startup
    database connectivity
    task creation
    PENDING -> RUNNING
    COMPLETED / FAILED transitions
    lease behavior
    idempotency records
    recovery metadata

Do not send production traffic to the restored database.

#### Test 6: deletion/retention test

Attempt the normal retention cleanup.

Verify:

- backups younger than fourteen days remain;
- backups older than the configured window are eligible for deletion;
- cleanup cannot delete the last required recovery point;
- cleanup activity is logged without secrets.

## Acceptance evidence

The acceptance record should contain:

    backup system version
    backup runner version
    source database identifier
    backup timestamps
    migration revision
    artifact hashes
    encryption key identifier
    restore start/end timestamps
    restored PostgreSQL version
    restore result
    application smoke-test result
    retention calculation
    oldest successfully restored recovery point

It must not contain:

    passwords
    DATABASE_URL values
    session cookies
    bearer tokens
    private encryption keys
    production connection strings

## What this does and does not bypass

This design bypasses the **operational dependency** on RDS's short automated-backup retention by maintaining an independent recovery system.

It does not bypass, modify, or falsify AWS's RDS retention setting.

The distinction is important:

    AWS RDS PITR window
        = 1 day today

    Independent logical-backup recovery window
        = >= 14 days after successful implementation/testing

    Required AWS-native 14-day PITR
        = still blocked until AWS permits the RDS configuration change

The independent backup path is therefore a resilience measure, not a claim that the AWS Free Tier restriction has been defeated.

## Preferred production architecture

    +--------------------------+
    | AWS RDS PostgreSQL       |
    | verified control plane  |
    +------------+-------------+
                 |
                 | TLS / backup identity
                 v
    +--------------------------+
    | Hardened backup runner   |
    | EC2 or VM                |
    | no master password       |
    | in source/logs           |
    +------------+-------------+
                 |
        +--------+--------+
        |                 |
        v                 v
  compress/encrypt   integrity manifest
        |                 |
        v                 v
  independent object   GitHub repository
  storage              metadata/release
        |
        v
  >=14-day retention

The existing OmniKali gateway -> PostgreSQL -> worker -> Kali architecture remains unchanged.

The backup plane is additive and does not participate in task ownership, worker leases, execution fencing, or task lifecycle semantics.

## Operational rule

Do not describe the system as having fourteen-day RDS backup retention until the RDS API itself reports fourteen days.

Describe the independent mechanism as fourteen-day independent recovery coverage only after the oldest retained recovery point has been successfully restored and the application-level verification passes.
