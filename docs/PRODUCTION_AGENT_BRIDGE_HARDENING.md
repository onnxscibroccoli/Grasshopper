# Production agent bridge hardening contract

Status: **formalization target; no production behavior changed by this document**.

## Verified bridge behavior

The recovered production bridge is the low-level QEMU execution primitive:

`authenticated HTTP -> omni-agent -> virsh qemu-agent-command -> guest-exec -> guest-exec-status -> result`

The bridge currently provides:

- bearer authentication;
- request-size protection;
- command, cwd, and timeout validation;
- bounded polling;
- stdout/stderr capture;
- process-local execution UUIDs.

The bridge does not provide:

- durable operation identity;
- durable execution receipts;
- executor-side idempotency;
- durable cancellation;
- cancellation acknowledgement;
- external side-effect fencing.

## Control-plane guarantee

The PostgreSQL task layer supplies durable operation identity and owner/lease fencing.

That establishes control-plane ownership semantics, not universal exactly-once external side effects.

A stale worker can be fenced from completing the durable task after lease reclamation. That does not prove that an already-started external command stopped executing.

## Command disposition classes

A future production executor contract should classify each operation before execution.

### Read-only / naturally idempotent

Examples include inspection commands whose repeated execution has no meaningful external side effect.

Requirements:

- durable operation identity;
- stale-owner fencing at the control plane;
- ordinary retry/reconciliation permitted.

### Idempotent mutation

The operation changes external state but repeated execution of the same operation identity is defined to converge safely.

Requirements:

- durable operation identity must be propagated to the executor or external operation;
- duplicate execution must return or reconcile against the existing operation;
- completion must carry an execution receipt sufficient to distinguish completion from absence of completion.

### Non-idempotent mutation

Repeated execution can create an additional external side effect.

Requirements:

- an executor-side idempotency mechanism, cancellation fence, or external transaction mechanism;
- stale-worker recovery alone is insufficient;
- ambiguous interruption must remain indeterminate until reconciliation establishes outcome;
- the control plane must not report confirmed completion without executor evidence.

### Interactive / long-running

Operations can remain active long enough that cancellation and worker failure are material.

Requirements:

- durable operation identity;
- cancellation request persistence;
- cancellation acknowledgement from the executor;
- bounded cancellation/reconciliation window;
- explicit indeterminate state when execution outcome cannot be established.

## Cancellation contract

The control plane may record that cancellation was requested.

It may report cancellation as confirmed only after the executor acknowledges the cancellation boundary defined for that command class.

A process termination signal by itself is not proof that an external side effect did not occur.

## Reconciliation contract

When executor connectivity is lost after dispatch:

1. retain the durable operation identity;
2. do not immediately retry non-idempotent work;
3. reconcile using executor receipt, external operation identity, or command-specific state inspection;
4. report `orphaned` / indeterminate when outcome remains unresolved;
5. only transition to confirmed completion or failure when evidence supports that state.

## Compatibility rule

These semantics are formalization targets around the recovered production bridge.

Implementing them in production changes a validated contract and therefore requires:

- existing behavior recorded;
- compatibility impact recorded;
- migration/recovery procedure;
- full acceptance evidence covering normal execution, worker termination, stale lease reclaim, duplicate fencing, gateway restart, database failure, and network interruption.

No production executor behavior is changed by this document.

## Formal executor disposition boundary

The reference implementation now models command disposition explicitly:

- `read_only`
- `idempotent_mutation`
- `non_idempotent_mutation`
- `interactive`

Executor results must explicitly identify one of:

- `confirmed`
- `cancelled`
- `indeterminate`

This is a contract layer, not a claim that the recovered production bridge already enforces these semantics.

A non-idempotent or interactive operation interrupted after dispatch must remain indeterminate until executor-side or external reconciliation establishes the outcome. A cancellation result cannot simultaneously be reported as confirmed completion.

The reference durable executor now also fences a race where cancellation has been acknowledged but an in-flight adapter later reports `confirmed`: that result is downgraded to `indeterminate` with reconciliation metadata rather than allowing a false confirmation.

Production adoption still requires wiring these fields through the recovered gateway/bridge boundary, implementing an executor-side cancellation boundary for supported command classes, and adding command-type-specific acceptance evidence. The recovered QEMU execution primitive remains unchanged by the reference-layer hardening.
