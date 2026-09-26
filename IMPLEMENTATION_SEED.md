# OmniKali Final Implementation Project Seed

## Mission

Continue OmniKali implementation from the passed production acceptance gate.

This project is **not** an architecture-discovery exercise and must not redesign, substitute, or regress the already-validated production architecture.

The implementation phase is:

**verified production baseline -> hardening -> formalization -> reproducibility -> controlled generalization**

The canonical source repository is `onnxscibroccoli/Grasshopper`.

## Source of truth

The verified production system is the source of truth for implementation decisions.

Historical production evidence:

- Production fix commit: `38903b021cca75189a99e1ed88b508bae577f048`
- Normal production acceptance: `396780ea-9405-4978-a1bb-2b61c210f8dd`
- Recovery production acceptance: `145f00b8-049d-49d3-9581-cde87aa62f1f`
- Full acceptance evidence: Grasshopper PR #1

Acceptance evidence is historical implementation evidence. Do not repeatedly re-discover or re-validate it unless a subsequent change affects the behavior it establishes.

## Verified production baseline

The following are invariants unless deliberately changed through an explicit architectural decision:

- Helix gateway is live and healthy.
- Real authenticated mobile-browser requests reach the production gateway.
- `POST /api/v1/tasks` creates real production tasks.
- PostgreSQL is the production persistence layer.
- Task lifecycle is `PENDING -> RUNNING -> COMPLETED | FAILED`.
- Worker leases are reclaimed after expiry.
- Worker termination while RUNNING is automatically recovered.
- Replacement worker ownership is established through the task state/lease mechanism.
- Real Kali execution is verified.
- Result markers are verified.
- Gateway restart initializes the worker correctly; the previously discovered lazy-worker initialization defect is fixed.
- No plaintext credentials, synthetic sessions, or exposed browser cookies are part of the acceptance path.
- Secret-manager-backed configuration and least-privilege IAM boundaries are preserved.

## Execution semantics

The verified contract is **not universal exactly-once execution**.

The acceptance evidence demonstrated:

`FIRST -> FIRST_COMPLETE -> DUPLICATE_BLOCKED`

This establishes:

- control-plane task ownership is fenced;
- stale worker ownership can be reclaimed;
- replacement workers can safely complete recovered tasks;
- idempotency guards can prevent duplicate side effects.

It does **not** establish exactly-once side effects for arbitrary commands.

For generic non-idempotent commands, exactly-once side effects require executor-side idempotency and/or cancellation fencing appropriate to the command and execution environment.

Never claim universal exactly-once semantics without executor-level enforcement.

## Implementation priorities

### 1. Preserve the validated architecture

Preserve:

- provider-neutral PostgreSQL architecture;
- authenticated gateway -> database -> worker -> Kali execution path;
- existing task/state/lease contracts;
- existing recovery/reconciliation behavior;
- existing credential and session boundaries.

Do not reintroduce Neon as a production requirement.

Do not replace PostgreSQL merely for convenience.

Do not rebuild the Grasshopper architectural models.

Do not weaken credential boundaries.

Do not embed credentials in source, configuration, prompts, or test fixtures.

### 2. Harden executor semantics

Implement and test executor-side behavior for:

- idempotency keys and durable operation identity where applicable;
- cancellation propagation;
- cancellation acknowledgement;
- bounded cancellation/reconciliation windows;
- prevention or detection of duplicate side effects;
- command-type-specific handling for non-idempotent operations;
- explicit distinction between control-plane completion and external side-effect completion.

The control plane must never imply a stronger guarantee than the executor actually provides.

### 3. Preserve recovery behavior

Maintain automatic recovery and state reconciliation within the established recovery window.

Recovery must remain based on durable state and leases, not process-local assumptions.

A recovered task must not silently acquire two simultaneously authoritative owners.

### 4. Security

Maintain:

- least-privilege IAM;
- secret-manager-backed configuration;
- protected runtime configuration;
- authenticated gateway access;
- no plaintext production credentials;
- no synthetic sessions on the acceptance path;
- no exposed browser cookies;
- no secrets in logs, fixtures, prompts, commits, or generated artifacts.

### 5. Integration and acceptance coverage

Maintain integration/acceptance coverage for:

1. normal execution;
2. worker termination;
3. stale lease reclamation;
4. replacement-worker completion;
5. duplicate-side-effect fencing;
6. gateway restart;
7. database connectivity failure;
8. simulated network interruption.

Tests must exercise real state transitions and failure boundaries rather than merely asserting mocked success.

### 6. Reproducibility

The intended system must ultimately be reproducible by a sufficiently authorized automation agent from canonical source of truth without undocumented human intervention.

Human-operated deployment may remain a development/debugging path, but it must not be a prerequisite for reproducibility.

Reproducibility includes:

- deterministic environment/bootstrap procedures;
- explicit infrastructure configuration;
- migration/application ordering;
- secret and IAM prerequisites;
- service lifecycle configuration;
- health/readiness verification;
- integration/acceptance execution;
- documented rollback/recovery procedures.

## Architectural scope

Kali is the verified execution environment, not the definition of OmniKali.

The implementation should preserve a layered model:

```
OmniKali
|
+-- Remote AI Computer
|   +-- provisioned execution environments
|       +-- Kali
|       +-- Linux
|       +-- Windows
|       +-- future edge/device environments
|
+-- Agent Execution Platform
|   +-- tasks
|   +-- workers
|   +-- leases
|   +-- execution
|   +-- artifacts
|   +-- idempotency
|   +-- cancellation
|   +-- recovery
|
+-- Agent Infrastructure Control Plane
    +-- authentication
    +-- authorization
    +-- provisioning
    +-- orchestration
    +-- durable state
    +-- observability
    +-- persistent encrypted state
    +-- resource management
```

Generalization must happen outward from the proven core. It must not destabilize the verified production path.

## Definition of done

The implementation project is complete when the verified production system has:

- reproducible deployment;
- durable task/state/lease semantics;
- authenticated execution;
- secure secret handling;
- worker lifecycle recovery;
- executor-side idempotency/cancellation controls appropriate to command type;
- comprehensive integration and acceptance coverage;
- operational telemetry and failure recovery;
- architecture and operational documentation synchronized with the actual deployed system.

## Engineering rule

**Freeze the proven core. Build the reproducible reference implementation around it. Then generalize outward.**

Any proposed change that modifies a validated contract must first document:

1. the existing verified behavior;
2. the reason the change is required;
3. the compatibility impact;
4. the migration/recovery strategy;
5. the new acceptance evidence required.

No architecture substitution is permitted merely because an alternative is easier to implement.

## Initial implementation workstream

Start with hardening and formalization, in this order:

1. inventory the deployed contracts and configuration boundaries;
2. make deployment and environment reconstruction reproducible;
3. formalize executor idempotency/cancellation semantics by command type;
4. expand failure-injection and integration coverage;
5. establish operational telemetry and recovery diagnostics;
6. synchronize architecture/operations documentation with deployed reality;
7. only then generalize execution environments and resource orchestration.

The production acceptance gate is already passed. The implementation project begins here.
