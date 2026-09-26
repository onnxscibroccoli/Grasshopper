# Grasshopper

A clean, reproducible control-plane reference implementation. The existing OmniKali/Helix stack is evidence only; this repository defines the contract independently.

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

## Reproduce

    ./scripts/bootstrap.sh
    npm test
    node bin/omnikali.mjs status

No production credentials or live-machine assumptions are required.
