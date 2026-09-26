# Production configuration snapshot: 2026-09-26 pre-hardening

Captured before the approved live hardening changes.

## AWS identity

- Account: 913427212571
- Region: us-east-1
- Snapshot time: 2026-09-26T18:42:58Z

## EC2 IAM role

Role: `HelixKaliDesktopRole`

Attached managed policy:
- `arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore`

Inline policies:
- HelixCognitoGatewayClient
- HelixControlPlaneDatabaseSecretRead
- HelixGatewayCognitoClientRead
- HelixPersistentWorkspaceEbs

The complete non-secret inline policy documents were captured in the execution record associated with this snapshot. No secret values are stored here.

## RDS

Instance: `helix-control-plane`

- Engine: PostgreSQL 18.3
- Class: db.t3.micro
- Status: available
- Multi-AZ: true
- Primary AZ: us-east-1b
- Secondary AZ: us-east-1a
- Publicly accessible: false
- Storage encrypted: true
- Deletion protection: true
- Backup retention: **1 day**
- Backup window: 05:00-05:30 UTC
- LatestRestorableTime observed: 2026-09-26T18:37:52Z
- Automated master secret: active
- Existing database secret rotation: enabled, 7 days

## Point-in-time rollback snapshot

Created immediately before hardening:

`helix-control-plane-pre-hardening-20260926`

The manual RDS snapshot is the rollback database state for this hardening operation.

## Live agent credential boundary

Before hardening:

- systemd unit: `omni-agent.service`
- credential source: `/etc/helix/agent.env`
- mode: 0600
- owner: root:root
- keys present: AGENT_HOST, AGENT_PORT, AGENT_VM, AGENT_TOKEN
- secret values intentionally excluded from this snapshot

The intended post-hardening state is Secrets Manager-backed runtime injection with no static agent token file.

## Rollback rule

Do not delete the pre-hardening RDS snapshot until post-change acceptance is complete.
