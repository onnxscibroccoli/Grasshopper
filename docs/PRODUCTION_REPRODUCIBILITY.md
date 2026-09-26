# Production reproducibility contract

This document formalizes reconstruction of the verified production system. It does not redesign the architecture or claim that every deployment artifact is already present.

## Verified target

The production reference is the accepted authenticated gateway -> PostgreSQL -> worker -> Kali path.

Established invariants include PostgreSQL persistence, secret-manager-backed runtime configuration, least-privilege IAM, durable task ownership and leases, worker recovery, correct worker initialization after gateway restart, and authenticated acceptance without exposed browser cookies or synthetic sessions.

## Reconstruction order

### 1. Source and environment
- obtain the canonical source revision;
- verify runtime prerequisites;
- select an explicit deployment environment;
- fail closed when required configuration is absent.

### 2. Infrastructure
Provision or verify the existing boundary:
- private application networking;
- production PostgreSQL;
- application security-group boundaries;
- gateway/worker compute;
- required IAM roles and policies;
- required Secrets Manager entries;
- authenticated external gateway entry point.

Do not substitute another database provider or change the gateway/database/worker topology.

### 3. Database initialization
- resolve the database secret through the authorized runtime identity;
- establish PostgreSQL connectivity;
- apply migrations in deterministic order;
- verify schema readiness;
- never print credentials or secret payloads.

Migration execution must be repeatable and non-destructive for already-applied migrations.

### 4. Protected runtime configuration
- materialize only required service configuration;
- keep credentials outside source control;
- protect runtime configuration with OS permissions;
- start the gateway through the service lifecycle mechanism;
- initialize the worker on startup.

No copied browser cookie or synthetic authentication state is permitted.

### 5. Readiness
Readiness must establish:
1. service active;
2. gateway health succeeds;
3. database usable;
4. worker initialized;
5. authenticated task submission reaches the control plane.

### 6. Acceptance
Automate normal execution, worker interruption, stale lease reclamation, replacement-worker completion, duplicate-side-effect fencing, gateway restart, database connectivity failure, and simulated network interruption.

Evidence records task IDs, state transitions, timestamps, and non-secret result markers only.

## Rollback and recovery

Rollback must preserve durable task ownership. Do not delete task state during service rollback. Preserve PostgreSQL state unless an explicit database rollback exists. Reconcile stale leases after recovery. Replacement ownership must be established through durable state and leases.

An interrupted external operation remains indeterminate unless executor-side evidence establishes its outcome. Control-plane completion is never proof of an external side effect by itself.

## Current artifact gaps

The repository still needs:
- infrastructure-as-code for deterministic AWS/network/database/compute reconstruction;
- IAM policy definitions;
- secret reference/ownership/rotation contract;
- deterministic PostgreSQL migration runner;
- service lifecycle definition;
- machine-verifiable readiness checks;
- automated acceptance runner;
- rollback procedure;
- recovery diagnostics and telemetry.

A manual deployment that works is not considered reproducibility.

## Security invariants

Never place production passwords, credential-bearing database URLs, session cookies, access tokens, private keys, or browser authentication state in source, fixtures, generated artifacts, logs, prompts, or commits.

Pass secret references rather than secret values wherever the platform permits.

## Compatibility rule

Any artifact that would change a validated production contract requires documentation of existing behavior, reason for change, compatibility impact, migration/recovery strategy, and new acceptance evidence. Convenience is not sufficient justification for architectural substitution.
