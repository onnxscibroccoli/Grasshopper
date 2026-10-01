# Cooperative Development Charter: Grasshopper + Broccoli

## Purpose

Grasshopper is the cooperative orchestration and evidence layer for the OmniKali development system. Broccoli and broccoli-core are implementation sources, runtime components, experiments, and recoverable prior art.

The system must improve itself without treating any single historical implementation as unquestionable ground truth.

## Roles

### Grasshopper

Grasshopper owns:

- orchestration
- task decomposition
- agent execution boundaries
- evidence and acceptance gates
- cross-repository recovery
- architecture records
- lifecycle supervision
- reproducibility
- promotion decisions

### broccoli-core

broccoli-core owns reusable local Android execution primitives, including the canonical Rish transport adapter and runtime mechanisms proven on-device.

### Broccoli

Broccoli is a historical and experimental implementation source. Useful behavior may be recovered, but every recovered component must pass current tests and current boundary rules.

### Android orchestrator device

The current Android device is an execution surface. The cooperative system may inspect and operate within the privileges actually granted to the current Termux user and Shizuku/Rish transport.

It must never claim privileges that have not been proven.

## Recovery rule

Recover behavior, not assumptions.

For each candidate implementation:

1. Locate the source.
2. Identify its original contract.
3. Identify known failure modes and degradation lessons.
4. Port the smallest useful unit.
5. Add a current test.
6. Run the test on the actual execution surface when applicable.
7. Record evidence.
8. Promote only after the gate passes.

## Android access contract

The supported chain is:

`RDC -> Termux -> Rish -> Shizuku -> Android shell`

A successful process exit is insufficient evidence.

A privileged Android execution claim requires a target-side artifact or equivalent observable proof showing the expected result.

Current shell identity, device identity, SDK, and transport state should be recorded as evidence, not inferred.

The current user role is the operator context. The system may automate actions available to that role, but must not attempt silent privilege escalation.

## Agentic development loop

The cooperative loop is:

`intent -> inventory -> recover -> test -> execute -> observe -> record -> promote`

Every autonomous change should answer:

- What was requested?
- Which existing implementation was reused?
- What evidence justified reuse?
- What changed?
- What was tested?
- What remains unproven?
- What is the rollback path?

## Bootstrap contract

The Android recovery bootstrap must be safe to invoke repeatedly from RDC.

It must:

- be idempotent where practical
- preserve evidence
- avoid production infrastructure mutation
- avoid privilege escalation
- fail closed when required proof is missing
- never treat RC=0 as sufficient transport proof
- maintain a durable local recovery manifest

## Development memory

GitHub is the durable cooperative memory.

Important decisions, recovered implementations, tests, evidence, and unresolved blockers belong in repositories and documented artifacts rather than relying on chat history.

## Promotion rule

No implementation becomes canonical merely because it exists in an older repository.

Canonical means:

- current contract is documented
- current tests pass
- relevant live boundary is proven
- security boundary is explicit
- rollback or replacement path is known

## Anti-degradation rules

Do not:

- replace working transport because a caller used the wrong cwd
- merge placeholders as completed functionality
- duplicate canonical scripts without an explicit reason
- treat empty stdout with RC=0 as success
- confuse transport proof with product proof
- hide unresolved lifecycle failures
- collect sensors or user data without a defined purpose and boundary

## Desired end state

The phone should be able to remain the operator surface while Grasshopper coordinates autonomous development in the background.

The Android orchestrator should be able to:

- launch local development agents
- invoke tested Android execution primitives
- inspect repository state
- run acceptance gates
- recover known implementations
- create evidence
- submit bounded changes
- hand unresolved decisions back to the operator

The system should remain reproducible even when chat context is unavailable.
