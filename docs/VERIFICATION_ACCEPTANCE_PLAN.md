# Verification and Acceptance Plan

## Layer 1 — Static

- Repository is clean or intentional changes are documented.
- No credentials or secret values occur in source/config/docs.
- Architecture and ADR references agree.
- Task and state contracts are explicit.
- Infrastructure is reproducible and auditable.

## Layer 2 — Functional

- Agent registration and resource declaration work.
- Task creation is idempotent.
- Locks enforce exclusive ownership and expiry.
- Task execution records terminal results.
- Unsupported targets fail without execution.

## Layer 3 — Integration

- Authenticated gateway accepts a valid task contract.
- Task is persisted in authoritative PostgreSQL.
- Worker claims the task with ownership.
- Execution adapter receives only the permitted payload.
- Result and lifecycle evidence are persisted.
- Stale ownership prevents obsolete workers from committing completion.

## Layer 4 — Operational

- Gateway restart recovers without corrupting state.
- Worker restart/replacement reconciles stale tasks.
- Lock expiry is reclaimed.
- Node termination converges to a reconciled state within the target recovery budget.
- Public desktop origin recovery follows the documented CloudFront/Kali procedure.
- Source, deployed artifact, service state, and endpoint state can be compared independently.

## Layer 5 — Security

- Production DB is private.
- DB ingress is restricted to authorized security groups.
- Runtime secret retrieval never prints the secret.
- AWS permissions are least privilege.
- Authentication and workspace ownership are enforced server-side.
- Sensitive values never enter GitHub, IcePanel, prompts, or logs.

## Layer 6 — End-to-end

Required final proof:

`authenticated request -> gateway -> PostgreSQL state -> worker -> execution adapter -> Kali -> terminal state -> audit evidence`

Repeat with:
- duplicate idempotency key;
- concurrent worker contention;
- worker crash;
- stale heartbeat;
- node termination;
- database/repository configuration drift.

The final handoff must include dated evidence and exact test results rather than confidence statements.
