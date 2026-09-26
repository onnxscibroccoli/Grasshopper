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

The repository now contains the reproducible AWS RDS PostgreSQL module at infra/aws/control-plane-db. It consumes the existing production VPC, private DB subnets, and application security groups rather than creating a replacement application topology.

Do not substitute another database provider or change the gateway/database/worker topology.

The RDS module defaults to the intended 14-day PITR retention target. The live instance remains at 1 day because AWS rejected the attempted increase under the current Free Tier restriction. The target is not considered achieved until an authorized infrastructure change succeeds and is verified.

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

The repository includes machine-verifiable static gates for the production baseline, service lifecycle, artifact provenance, and RDS infrastructure contract. Live readiness and acceptance remain deployment-time operations.

### 6. Acceptance
Automate normal execution, worker interruption, stale lease reclamation, replacement-worker completion, duplicate-side-effect fencing, gateway restart, database connectivity failure, and simulated network interruption.

Evidence records task IDs, state transitions, timestamps, and non-secret result markers only.

## Rollback and recovery

Rollback must preserve durable task ownership. Do not delete task state during service rollback. Preserve PostgreSQL state unless an explicit database rollback exists. Reconcile stale leases after recovery. Replacement ownership must be established through durable state and leases.

An interrupted external operation remains indeterminate unless executor-side evidence establishes its outcome. Control-plane completion is never proof of an external side effect by itself.

## Current artifact gaps

Live production schema and migration-ledger recovery is complete. The observed baseline is recorded in reference/production/observed-db-baseline.json and docs/PRODUCTION_LIVE_EVIDENCE.md.

Remaining reproducibility work is intentionally separated into code-complete reference artifacts and deployment-time authorization:

- reconcile the actual production VPC, two or more private DB subnets across Availability Zones, and application security-group IDs through an authorized AWS identity;
- perform Terraform format/validation/plan/apply from that authorized infrastructure identity;
- complete the production IAM policy definition and reconciliation for every service boundary;
- complete a deterministic production migration/readiness wrapper around the actual Helix release artifact;
- complete the automated live acceptance runner for normal, recovery, duplicate-fencing, restart, database-failure, and network-interruption scenarios;
- complete operational telemetry and recovery diagnostics;
- retain rollback and recovery evidence for each production release.

A manual deployment that works is not considered reproducibility.

## Security invariants

Never place production passwords, credential-bearing database URLs, session cookies, access tokens, private keys, or browser authentication state in source, fixtures, generated artifacts, logs, prompts, or commits.

Pass secret references rather than secret values wherever the platform permits.

## Compatibility rule

Any artifact that would change a validated production contract requires documentation of existing behavior, reason for change, compatibility impact, migration/recovery strategy, and new acceptance evidence. Convenience is not sufficient justification for architectural substitution.
