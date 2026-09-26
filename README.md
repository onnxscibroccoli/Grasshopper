# Grasshopper

A clean, reproducible OmniKali implementation project continuing from the verified production acceptance gate. The deployed production system is the source of truth; this repository formalizes, hardens, and reproduces that validated architecture.

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
