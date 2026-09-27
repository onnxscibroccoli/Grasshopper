# Independent PostgreSQL backup runner

This is the implementation companion to INDEPENDENT_POSTGRES_BACKUP.md.

## Scope

The runner provides an independent logical recovery path for the verified production PostgreSQL control plane. It does not change the RDS automated-backup retention setting and it does not create an RDS snapshot.

The production target remains:
- RDS native automated backup/PITR: currently 1 day
- independent logical recovery: at least 14 retained recovery points (target, not yet accepted)
- RDS native 14-day PITR: still pending authorized AWS change

## Observed activation status (2026-09-27)

| Boundary | Observation | Evidence still required |
|---|---|---|
| Dedicated runner EC2 and scheduler | Instance exists; timer active | Successful service invocation and documented clean installation |
| Storage | Encrypted, versioned S3 bucket exists; zero backup objects observed | Artifact and manifest upload, checksum, storage controls, and independent download |
| Recovery key and encryption input | Age recovery secret has `AWSCURRENT`; public age recipient installed | Verified separation and authorized isolated decryption using the recovery private key |
| Database backup identity | No successful database secret retrieval or dump established by these observations | Scoped database secret access, TLS connection, and complete dump |
| Runner service | Service failed on missing `/usr/local/lib/independent-backup-policy.mjs`; TLS patch applied on host | Reconcile source and host TLS behavior, install all imports, and prove repeatable execution |
| Recovery objective | No observed successful backup or restore | Isolated restore and application acceptance, then qualifying retained history |

These are dated observations, not a production activation claim. The pending inventory and TLS pull requests are separate work; neither is a merged release or evidence of successful backup. The currently checked-in script imports `../lib/independent-backup-policy.mjs` relative to its `scripts/` location and passes `--sslmode=require` to `pg_dump`. Treat the live TLS patch as runtime drift until its reviewed source and the deployed bytes agree. Do not infer a successful TLS connection from the source flag or host patch alone.

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

The independent path is accepted only when there are at least 14 distinct, independently restorable recovery points within the policy window, with unique backup identities and the oldest required point demonstrably retained.

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

The runner stores each recovery point beneath `<BACKUP_S3_URI>/<source-instance>/` using a collision-resistant backup ID, so the artifact and its manifest cannot overwrite each other when the destination is an S3 prefix. The S3 prefix should use an explicit lifecycle policy consistent with the required retention period. The validator is an additional guard, not a replacement for lifecycle policy.

## Hypervisor note

If the runner is hosted in a QEMU/libvirt VM, the hypervisor snapshot protects the runner VM only. It is not an RDS snapshot and must not be counted as a database recovery point.

## Production activation gate

Use this order for a controlled deployment or repair:

1. Record the host unit, environment references, installed file paths and hashes, IAM/DB permissions, network boundary, and current failure without recording secret values. Reconcile the reviewed TLS fix and policy import with one clean source revision.
2. Build a complete, versioned installation from that source. Deploy the runner and `lib/independent-backup-policy.mjs` together at paths that preserve their relative import (or use a tested package layout). Install the reviewed service and timer definitions; confirm the service invokes the intended revision. Verify the backup identity, scoped Secrets Manager access, S3 destination, public recipient, and separately held recovery private key.
3. In a controlled run, verify a zero-exit service result, a fresh encrypted artifact and manifest in S3, and manifest checksum/size against the downloaded artifact. Do not treat timer activation or a local staging file as upload success.
4. Decrypt and restore into an isolated database, verify schema and representative state, and run authenticated application acceptance against that isolated restore. Keep production traffic and production database writes away from the restore test.
5. Observe scheduled runs and retention until at least 14 distinct points meet the defined policy, including an independently restorable oldest required point. Record failures, alerting, and rollback procedure; only then claim independent fourteen-day recovery coverage.

Production service activation and restore testing require the authorized infrastructure and recovery operators. This documentation records the order and acceptance evidence; it does not report those gates as complete.
