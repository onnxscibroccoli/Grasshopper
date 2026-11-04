# Implementation Requirements

## Required sequence

### 1. Environment validation
Verify repository, runtime dependencies, AWS identity, network path, and required permissions without mutating live state.

### 2. Durable state engine
Use authoritative PostgreSQL for production state. Preserve transactional lifecycle transitions, ownership/fencing, advisory locking, idempotency, and reconciliation.

### 3. Execution adapters
Implement explicit adapters for the execution environments actually required by the product: remote host, QEMU/libvirt/Kali, desktop/GUI, and AWS resources as applicable.

### 4. Observability and recovery
Every critical service needs health/readiness signals, structured lifecycle evidence, bounded timeouts, restart behavior, stale-owner reconciliation, and a documented recovery path.

### 5. Acceptance
Run static, functional, integration, operational, security, and end-to-end tests. Failure tests must include process restart, worker staleness, lock expiry, network failure, and node termination/recovery.

## Contracts

Task request:
```json
{
  "task_id": "UUID",
  "target": "STRING",
  "payload": "OBJECT",
  "idempotency_key": "STRING"
}
```

Production task state is durable and ownership-aware. The implementation must prevent stale workers from completing work after ownership changes.

## Security

- No secrets in source, prompts, issues, diagrams, or logs.
- Least-privilege AWS roles.
- No plaintext production credentials.
- Keep the RDS database private.
- Scope application data by authenticated identity.
- Audit privileged mutations.
- Fail closed when required production configuration is absent.

## Idempotency

Every mutating workflow must be idempotent or protected by a unique execution/idempotency key. Recovery must converge safely after retries and partial failure.

## Database

The application depends on PostgreSQL semantics and `DATABASE_URL`, not a provider SDK. Production infrastructure owns the database. Migrations are ordered, transactional, and guarded by advisory locking. Readiness must fail closed.

## Existing implementation evidence

Helix already has an authenticated task dispatch path and 14/14 state/dispatch/runner tests. Do not rebuild those contracts from scratch; reconcile and extend them where the Grasshopper model requires stronger distributed guarantees.
