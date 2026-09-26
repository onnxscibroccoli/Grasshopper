# Independent PostgreSQL backup runner IAM reference module

This module defines the least-privilege AWS identity boundary for the independent PostgreSQL backup runner.

## Permissions

The role can:

- read exactly one Secrets Manager secret;
- list only the configured backup prefix;
- upload backup objects and abort incomplete multipart uploads under that prefix;
- use only the configured KMS key for S3 SSE-KMS operations.

The role cannot read S3 backup objects, modify RDS, modify Secrets Manager, administer KMS, or access unrelated secrets.

## Trust

The reference module trusts EC2 because the runner may be hosted on a dedicated EC2 instance or an authorized VM environment that uses an equivalent AWS identity boundary. If the actual deployment uses a different AWS workload identity, adapt only the trust mechanism while preserving the permission boundary.

## Safety

The module contains no production identifiers or credentials. Applying it is a deployment action and is not performed by this repository change.

The database credential remains in Secrets Manager. The runner continues to use its application-layer age encryption before upload.
