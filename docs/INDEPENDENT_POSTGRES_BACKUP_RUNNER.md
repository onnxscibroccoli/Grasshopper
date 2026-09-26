# Independent PostgreSQL backup runner

This is the implementation companion to INDEPENDENT_POSTGRES_BACKUP.md.

## Scope

The runner provides an independent logical recovery path for the verified production PostgreSQL control plane. It does not change the RDS automated-backup retention setting and it does not create an RDS snapshot.

The production target remains:
- RDS native automated backup/PITR: currently 1 day
- independent logical recovery: at least 14 retained recovery points
- RDS native 14-day PITR: still pending authorized AWS change

## Execution boundary

RDS PostgreSQL -> TLS / dedicated backup identity -> backup runner -> Secrets Manager -> pg_dump -> zstd -> age encryption -> SHA-256 manifest -> S3 object storage.

GitHub remains the source-controlled home for the runner, policy, tests, manifests schema, and recovery tooling. Production database contents are not written to Git history.

## Required runtime inputs

- BACKUP_DB_SECRET_ID: Secrets Manager secret containing host, username, password, and optionally port, dbname, server_version.
- BACKUP_SOURCE_INSTANCE: non-secret database identifier.
- BACKUP_MIGRATION_REVISION: migration/application revision.
- BACKUP_ENCRYPTION_KEY_ID: non-secret identifier for the encryption key.
- BACKUP_RECIPIENT_FILE: age recipients file containing only the public encryption recipient.
- BACKUP_OUTPUT_DIR: mode-0700 local staging directory.
- BACKUP_S3_URI: encrypted backup destination such as an S3 prefix.

The runner deliberately does not accept a password or credential-bearing DATABASE_URL as an environment variable.

## Runtime prerequisites

- AWS CLI with Secrets Manager read and S3 write permissions scoped to the backup secret and backup prefix.
- PostgreSQL pg_dump.
- zstd.
- age.
- TLS connectivity to RDS.
- a dedicated PostgreSQL backup identity.

The backup identity must have only the privileges required to perform the chosen dump. Do not reuse the Helix application writer identity.

## Backup procedure

1. Scheduler starts node scripts/independent-postgres-backup.mjs create.
2. The runner retrieves the database secret through Secrets Manager.
3. It writes a mode-0600 temporary pgpass file inside a mode-0700 temporary directory.
4. It runs pg_dump --format=custom --no-owner --no-acl.
5. It compresses the dump with zstd.
6. It encrypts the compressed artifact with the public age recipient.
7. It computes SHA-256 over the encrypted artifact.
8. It writes a non-secret JSON manifest.
9. It uploads the encrypted artifact and manifest to the configured S3 prefix.
10. It removes the temporary directory.

The password is never passed as a command-line argument. The backup artifact is encrypted before offload.

## Verification

npm run verify:independent-backup -- /path/backup.dump.zst.age /path/backup.dump.zst.age.json

This verifies required manifest fields, SHA-256, and artifact size. It does not decrypt or restore the database.

## Fourteen-day acceptance

The independent path is accepted only when there are at least 14 independently restorable recovery points within the policy window and the oldest required point is demonstrably retained.

npm run validate:independent-backup-retention -- /path/manifests.json 2026-09-26T12:00:00Z

Acceptance additionally requires:
1. download an encrypted backup into an isolated restore environment;
2. decrypt it using the recovery private key held outside the backup runner;
3. restore with pg_restore;
4. verify schema and migration revision;
5. verify representative task/state/lease data;
6. start an isolated Helix gateway/worker against the restored database;
7. submit a benign authenticated test task;
8. verify PENDING -> RUNNING -> COMPLETED;
9. verify lease/recovery and duplicate-fencing behavior where supported;
10. record the oldest successfully restored recovery point.

The acceptance record must contain no passwords, database URLs, browser cookies, bearer tokens, private keys, or raw production data.

## Scheduling and retention

Daily execution is the minimum practical schedule for a 14-day recovery-point requirement. Keep at least 14 distinct recovery points.

The S3 prefix should use an explicit lifecycle policy consistent with the required retention period. The validator is an additional guard, not a replacement for lifecycle policy.

## Hypervisor note

If the runner is hosted in a QEMU/libvirt VM, the hypervisor snapshot protects the runner VM only. It is not an RDS snapshot and must not be counted as a database recovery point.

## Production activation gate

Do not point this runner at production until the backup identity, Secrets Manager policy, S3 destination, encryption recipient, scheduler, and isolated restore environment have been provisioned and reviewed.

No live production backup is claimed by this code-only change.
