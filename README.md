# Grasshopper

A reference OmniKali implementation and production reconstruction project continuing from the verified production acceptance gate. The deployed production system supplies observed behavior; this repository formalizes the contracts and tracks the remaining source-to-host reconstruction work. Clean-host production reproduction is not yet established.

## Final implementation seed

See [`IMPLEMENTATION_SEED.md`](./IMPLEMENTATION_SEED.md) for the canonical implementation constraints, verified production baseline, execution semantics, hardening priorities, security boundaries, acceptance coverage, and Definition of Done.

The project begins with hardening, formalization, and reproducibility—not architectural discovery.

## North star

An authorized agent can reproduce the platform from source with no undocumented operator steps.

## First vertical slice

The local environment implements agent registration, resource declaration, durable state, exclusive locks, asynchronous task execution, task recovery/reconciliation, and deterministic export/import.

## Layout

- src/model.mjs — domain contracts and validation
- src/store.mjs — atomic JSON state store
- src/executor.mjs — execution-environment interface + local implementation
- src/control-plane.mjs — agent/task/lock/resource lifecycle
- src/clients/grok-control-plane-client.mjs — authenticated Grok client; no executor bypass
- src/mcp/grok-control-plane-tools.mjs — MCP facade; submit/cancel through GrokControlPlaneClient only
- bin/omnikali.mjs — reproducible CLI, including lock, export, and import
- test/recovery.test.mjs — crash/restart recovery tests
- environments/local.json — reference environment
- scripts/bootstrap.sh — source-to-running-state bootstrap
- docs/SERVICE_LIFECYCLE_CONTRACT.md — gateway/worker lifecycle boundary
- scripts/validate-service-lifecycle.mjs — lifecycle manifest validator

## Reproduce

    ./scripts/bootstrap.sh
    npm test
    node bin/omnikali.mjs status

No production credentials or live-machine assumptions are required.

`npm run verify:agentic-reproducibility` proves a clean Git archive can bootstrap and pass the suite. `npm run verify:agentic-control-plane` then reproduces the reference control plane lifecycle (lock, task, restart, export/import) from that same archive. Neither command claims production reconstruction. See [docs/AGENTIC_REFERENCE_CONTROL_PLANE.md](docs/AGENTIC_REFERENCE_CONTROL_PLANE.md).

For the dated production and independent-backup observations, deployment order, and open reconstruction gates, see [`docs/PRODUCTION_RECONSTRUCTION_STATUS.md`](./docs/PRODUCTION_RECONSTRUCTION_STATUS.md) and [`docs/INDEPENDENT_POSTGRES_BACKUP_RUNNER.md`](./docs/INDEPENDENT_POSTGRES_BACKUP_RUNNER.md).

## Independent backup runner

The runner uses libpq `PGSSLMODE=require` with a protected passfile for `pg_dump`; `--sslmode` is not a `pg_dump` command-line option. Run `npm test` to exercise the isolated TLS invocation check. A passing test does not activate production backups: the dedicated identity, encryption recipient, S3 destination, scheduler, required binaries, and isolated restore acceptance still need deployment and verification. See [backup runner requirements](docs/INDEPENDENT_POSTGRES_BACKUP_RUNNER.md).

## Production boundary

The local JSON reference does not deploy the existing PostgreSQL production gateway. See [production contract inventory](docs/PRODUCTION_CONTRACT_INVENTORY.md) for observed host and IAM state, verification limits, and the reproducibility gate.

## Read-only production lifecycle inventory

On the authorized Kali host, run `node scripts/inventory-service-lifecycle.mjs` to capture allowlisted systemd service properties for the gateway, agent bridge, and MCP service. It reports configuration file paths, not their contents, and does not query command lines or environment values. A running unit is not proof that authenticated task execution is healthy. Review the output before sharing it.
