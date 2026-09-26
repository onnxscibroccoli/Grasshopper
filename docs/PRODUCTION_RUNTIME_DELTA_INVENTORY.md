# Production runtime delta inventory

Status: **observed evidence; not yet a release artifact**.

Date of observation: 2026-09-26.

## Host

- AWS instance: `i-03b6a82d46271d9cd`
- instance type: `c7i-flex.large`
- private host: `172.31.8.59`
- VPC: `vpc-03a8b25046144eb2b`
- subnet: `subnet-015acf767e8d34e77`
- instance profile: `HelixKaliDesktopProfile`
- IAM role: `HelixKaliDesktopRole`

## Deployed application artifacts

The following hashes were read directly from the production host. They are runtime evidence and must not be treated as release hashes until their Git lineage is established.

| Artifact | SHA-256 |
|---|---|
| `/opt/helix/production/gateway/helix-gateway.mjs` | `9579defaaf9c0c13ad5dfe8bae0698463ace926cc3ebe5fef33037c4c36ca02d` |
| `/opt/helix/production/gateway/start-helix-gateway.sh` | `5b05eeb58429d221caa7c6ddd4de456b3a6ade6269157cd89df9a39aa725bd82` |
| `/opt/helix/production/gateway/state/agent-executor.mjs` | `6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e` |
| `/opt/helix/production/agent/omni-agent.mjs` | `ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d` |
| `/etc/systemd/system/helix-gateway.service` | `f88cf930f9f10631737ec24bca803d91c6c9db7e5f8207ace47b11572088e443` |
| `/etc/systemd/system/helix-gateway.service.d/10-database-secret.conf` | `54f9677522bec063791d9d24511f8dd6ce166754d5f8c64803ab540dc49337bb` |
| `/etc/systemd/system/omni-agent.service` | `a72aa781742523dd3c1ee3ae18b848953ad4fa22b8338e6759cbb53be81c33f3` |

## Runtime architecture observed

Gateway:

- systemd unit: `helix-gateway.service`
- root service account
- working directory: `/opt/helix`
- protected runtime environment: `/etc/helix/gateway.env`
- launcher: `/usr/local/sbin/helix-gateway-launcher`
- database secret is resolved at runtime through AWS Secrets Manager
- gateway starts the task worker during startup

Execution bridge:

- systemd unit: `omni-agent.service`
- root service account
- local listener: `127.0.0.1:8093`
- authenticated with an environment-provided agent token
- executes through libvirt QEMU guest-agent into VM `helix-omnikali`
- exposes command execution through `POST /execute`

The deployed `agent-executor.mjs` is a thin HTTP adapter to that bridge. It does not itself provide durable external-operation idempotency or cancellation.

## AWS dependency evidence

The host role contains narrowly named policies for:

- reading the RDS-managed database secret and decrypting its KMS key;
- reading the Cognito user-pool client configuration;
- persistent Helix workspace EBS operations;
- SSM management through the AWS managed policy.

The RDS instance is `helix-control-plane`, PostgreSQL 18.3, private, encrypted, Multi-AZ, deletion-protected, with CloudWatch PostgreSQL/upgrade log exports. The observed backup retention is 1 day and remains a hardening discrepancy against the intended 14-day target.

## Classification

These observations establish the deployed runtime boundary. They do **not** establish that the dirty production checkout is a reproducible release.

### Intended runtime configuration candidates

- systemd service lifecycle
- Secrets Manager reference
- IAM role/policy attachments
- RDS binding
- local execution bridge binding
- VM execution target

### Release-content candidates requiring lineage

- `production/gateway/helix-gateway.mjs`
- `production/gateway/state/agent-executor.mjs`
- `production/agent/omni-agent.mjs`
- `production/gateway/start-helix-gateway.sh`

The executor and omni-agent artifacts are not present in the accepted production-fix revision. Their origin and intended release status remain unresolved.

## Safety boundary

No secret values, browser sessions, passwords, credential-bearing URLs, private keys, or tokens are recorded here. Production was not modified during this inventory.
