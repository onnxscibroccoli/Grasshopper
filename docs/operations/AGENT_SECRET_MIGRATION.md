# Agent bridge Secrets Manager migration

## Production state

The live agent bridge token is now stored in AWS Secrets Manager under the secret reference:

`omnikali/production/agent-bridge-token`

The EC2 role `HelixKaliDesktopRole` has a dedicated inline policy allowing only `secretsmanager:GetSecretValue` and `secretsmanager:DescribeSecret` against that secret namespace.

The token is loaded into application memory through the AWS CLI and is not supplied through `AGENT_TOKEN` environment variables.

Production verification completed:

- secret fetch smoke test succeeded;
- `omni-agent.service` active;
- `helix-gateway.service` active;
- both health endpoints returned `ok: true`;
- real gateway executor -> agent bridge -> QEMU guest execution returned exit code 0;
- live process environments contain no `AGENT_TOKEN`;
- static `/etc/helix/agent.env` contains no `AGENT_TOKEN`;
- service restart counts returned to zero after cutover.

## Rollback

The pre-hardening RDS snapshot is `helix-control-plane-pre-hardening-20260926`.

For the credential path, rollback consists of removing the two Secrets Manager drop-ins, restoring the pre-migration agent environment file from the recorded snapshot procedure, and restarting the affected services. Do not delete the RDS snapshot until acceptance is complete.

## RDS backup retention blocker

The production RDS instance remains at 1-day automated backup retention.

An attempted change to 14 days was rejected by AWS with:

`FreeTierRestrictionError: The specified backup retention period exceeds the maximum available to free tier customers.`

No RDS configuration was changed by the failed request.

The 14-day PITR acceptance criterion therefore remains open and requires an account-level change that removes the Free Tier restriction. The existing Multi-AZ, encryption, deletion protection, and manual pre-hardening snapshot remain intact.
