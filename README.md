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
- bin/omnikali.mjs — reproducible CLI
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

For the dated production and independent-backup observations, deployment order, and open reconstruction gates, see [`docs/PRODUCTION_RECONSTRUCTION_STATUS.md`](./docs/PRODUCTION_RECONSTRUCTION_STATUS.md) and [`docs/INDEPENDENT_POSTGRES_BACKUP_RUNNER.md`](./docs/INDEPENDENT_POSTGRES_BACKUP_RUNNER.md).
