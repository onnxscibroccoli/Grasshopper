# Reference Architecture

## Core rule

The control plane owns desired state, identity, task lifecycle, lock ownership, and reconciliation. Execution environments are adapters. Providers are not part of the domain model.

## Domain

- Agent: authorized execution identity plus environment binding.
- Resource: declared capability with desired and observed state.
- Task: durable intent plus execution handle and result.
- Lock: exclusive coordination primitive with owner and expiry.
- Event: append-only lifecycle evidence.
- Environment: adapter that starts, stops, and observes executions.

## Vertical slice

The deterministic environment is intentionally non-privileged and reproducible. `ok:` commands complete successfully; `fail:` commands produce a deterministic failure. This makes state-machine and recovery behavior testable without touching a VM.

## Recovery contract

A reconciler may mark stale running tasks as `orphaned` and delete expired locks. Real adapters must make execution identity durable enough to observe after the control-plane process restarts.

## Next adapters

1. Local process adapter with a bounded command policy.
2. Remote host adapter behind an explicit capability boundary.
3. QEMU/libvirt adapter for VM lifecycle.
4. Browser/desktop adapter for GUI observation and interaction.
5. Cloud resource adapters for AWS/OCI infrastructure.

Adapters must report desired/observed state and never become hidden sources of truth.

## Evidence mapping

The current Helix implementation demonstrates useful operational concepts—durable task/lock ledgers, a QEMU guest boundary, tmux-backed tasks, and GUI locks. The reference deliberately does not copy its single-process implementation; those observations become conformance cases for later adapters.
