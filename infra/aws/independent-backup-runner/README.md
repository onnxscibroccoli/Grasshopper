# Independent PostgreSQL backup runner IAM reference module

This module defines the least-privilege AWS identity boundary for the independent PostgreSQL backup runner.

## Permissions

The role can:

- read exactly one Secrets Manager secret;
- list only the configured backup prefix;
- upload backup objects and abort incomplete multipart uploads under that prefix;
- use only the configured KMS key for S3 SSE-KMS operations.

The role cannot read S3 backup objects, modify RDS, modify Secrets Manager, administer KMS, or access unrelated secrets.

## Validator contract

`scripts/validate-independent-backup-runner.mjs` asserts against Terraform IAM Action lists in `main.tf` (parsed `actions = [...]` blocks), not README prose alone. It fails closed if Allow actions include `s3:GetObject`, `s3:GetObjectVersion`, `s3:DeleteObject`, or any `rds:` action. README wording remains a secondary contract check; Action-list parsing is authoritative for deny asserts.

## Trust

The reference module trusts EC2 because the runner may be hosted on a dedicated EC2 instance or an authorized VM environment that uses an equivalent AWS identity boundary. If the actual deployment uses a different AWS workload identity, adapt only the trust mechanism while preserving the permission boundary.

## Safety

The module contains no production identifiers or credentials. Applying it is a deployment action and is not performed by this repository change.

The database credential remains in Secrets Manager. The runner continues to use its application-layer age encryption before upload.
