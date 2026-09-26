# Independent backup storage reference module

This module defines the durable object-storage boundary for the independent PostgreSQL recovery path.

## Safety boundary

- It contains no production account IDs, credentials, database contents, or secret values.
- It requires an existing customer-managed KMS key ARN.
- It requires an explicit bucket name.
- It enables versioning and blocks public access.
- It denies S3 requests made without TLS.
- Lifecycle expiration defaults to 30 days and cannot be configured below the 14-day recovery target.
- Applying the module is a deployment action. This repository change does not provision or activate production storage.

## Layout

The module output backup_uri is intended for BACKUP_S3_URI. The runner writes each recovery point below that prefix and the source-instance path.

Each recovery point has a separate encrypted artifact and JSON manifest.

## KMS boundary

The S3 bucket uses an existing customer-managed KMS key for server-side encryption. Key administration and recovery controls must remain separate from the backup runner's S3 write permissions.

S3 encryption is an additional storage-layer control. The runner's age encryption remains the recovery artifact's application-layer encryption.

## Retention

The default 30-day lifecycle window provides margin over the 14-day minimum. Lifecycle policy is not proof that 14 independently restorable points exist. The retention validator and isolated restore acceptance remain authoritative.

## Activation prerequisites

Before applying against production, provision and review:

1. KMS key and recovery controls.
2. Dedicated backup bucket.
3. Backup runner IAM role with only required Secrets Manager read and S3 write permissions.
4. Dedicated PostgreSQL backup identity.
5. Age recipient and separately held recovery private key.
6. Scheduler.
7. Isolated restore environment.

Do not place raw production database artifacts in Git.
