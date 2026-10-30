# R5 Live Infrastructure Evidence 2026-10-06

## Production PostgreSQL

- Production instance: `helix-control-plane`
- PostgreSQL: 18.3
- Status: available
- Multi-AZ: true
- Deletion protection: true
- Automated backup retention: 1 day
- Attempt to raise retention to 14 days was rejected by AWS Free Tier with `FreeTierRestrictionError`.
- No production downtime or reboot was induced by that failed modification attempt.

## Independent backup channel

The dedicated backup runner is healthy and its daily backup service has produced independent encrypted PostgreSQL dump artifacts.

Verified S3 prefix:
`s3://omnikali-independent-postgres-backups-913427212571/postgres/helix-control-plane/`

At evidence capture:
- distinct `.dump.zst.age` artifacts: **14**
- matching JSON manifests: 14
- latest three artifacts were generated at approximately 18:24 UTC on 2026-10-06 and each completed with status PASS and a unique UUID plus SHA-256 manifest:
  - `helix-control-plane-2026-10-06T18-24-13-474Z-4f3fd477-35ae-4919-8285-9e3ca3a37802.dump.zst.age`
  - `helix-control-plane-2026-10-06T18-24-32-614Z-d9be0875-b62a-4783-8bd6-f942aa618ed6.dump.zst.age`
  - `helix-control-plane-2026-10-06T18-24-57-727Z-b196866c-f2c9-4ab1-a076-829a11172e8a.dump.zst.age`

This proves artifact generation and retention count. It does **not** by itself prove that all 14 artifacts have been decrypted and restored. The readiness gate must therefore continue to distinguish "14 artifacts present" from "14 restore points independently restore-tested."

## Isolated R5 database restore

An isolated RDS instance was temporarily restored from the latest production automated snapshot:

- identifier: `helix-control-plane-r5-20261006`
- source snapshot: `rds:helix-control-plane-2026-10-06-05-08`
- private: true
- Single-AZ
- db.t3.micro
- PostgreSQL 18.3
- deletion protection: false
- test-only tag: R5 isolated acceptance

The clone reached `available` and was reachable from the independent backup runner. A read-only query verified:
- database: `helix`
- PostgreSQL 18.3
- `omnikali_tasks`: 2 existing rows
- `omnikali_task_events`: 7 existing rows

The clone was deleted after infrastructure verification. No production database was mutated.

## Production Secrets Manager cutover

Live host verification on `helix-chatgpt-remote-desktop`:

- `omni-agent.service` is active.
- systemd drop-in references `HELIX_AGENT_TOKEN_SECRET_ID=omnikali/production/agent-bridge-token`.
- `/etc/helix/agent.env` contains only non-secret runtime routing values.
- Secrets Manager contains the referenced secret and a current version.
- Secret value was never emitted into evidence.
- Agent health endpoint: `http://127.0.0.1:8093/health` returned:
  `{"ok":true,"service":"omni-agent","vm":"helix-omnikali"}`

This is fresh live cutover evidence. The secret value remains external to source and manifests.

## Production lineage

Live Helix checkout verification:

- branch: `omnikali/production-db-bootstrap-20260926`
- deployed HEAD: `46ba4b71158a74db5ede97e300099370792ecff8`
- working tree dirty paths: **16**

The dirty paths include live runtime modifications, agent files, MCP files, and dated restore points. The checkout was **not** forcibly reset or cleaned because doing so could remove files currently required by running services or destroy restore artifacts.

The immutable source target documented by the reconstruction contract remains:
`b5bc9b4d2323d6bb4cffb4893578ae22911999ca`

Lineage remains OPEN until the runtime overlay is reconciled into immutable source and a clean deployed checkout is proven.

## Current R5 interpretation

PASS:
- production database healthy;
- independent backup service healthy;
- 14 independent encrypted backup artifacts exist;
- isolated RDS snapshot restore reaches a usable PostgreSQL 18.3 instance;
- production Secrets Manager cutover is live and healthy.

NOT_PROVEN / OPEN:
- independent dump decryption and restore test;
- all eight live acceptance scenarios;
- clean production source lineage;
- clean-host reconstruction.

No production task lifecycle, worker failure, database outage, or gateway restart was injected during this pass.
