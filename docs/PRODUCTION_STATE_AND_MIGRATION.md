# Production state and migration contract

The verified production control plane uses durable task ownership and recovery semantics.

## Required task semantics

The production implementation must preserve:

- task lifecycle: PENDING -> RUNNING -> COMPLETED | FAILED
- durable ownership through task state and leases
- lease expiry and reclamation
- replacement-worker ownership after stale-worker recovery
- operation identity where duplicate side effects require fencing
- cancellation acknowledgement
- explicit indeterminate outcomes when an interrupted external operation cannot be proven complete or failed

The reference implementation additionally models stopped and orphaned states so cancellation and indeterminate execution are not misreported as confirmed success or failure.

## Migration contract

Production database initialization must be deterministic and ordered.

A migration runner must:

1. connect using protected runtime credentials;
2. acquire database-level migration ownership;
3. apply migrations in deterministic order;
4. record applied migration identity durably;
5. fail without partially claiming an unapplied migration;
6. expose migration failure as a deployment failure;
7. never print credential-bearing connection strings.

No migration files are currently claimed by this contract. The runner must not invent schema from the reference JSON state store. The authoritative production PostgreSQL schema must be recovered from the deployed application before migration SQL is authored.

## Compatibility rule

A migration that changes task, lease, operation identity, cancellation, or recovery semantics is a validated-contract change. Before deployment it requires documentation of:

- existing verified behavior;
- reason for the schema change;
- compatibility impact;
- migration and rollback/recovery strategy;
- new acceptance evidence.

## Current status

The migration contract is formalized. Production migration SQL remains blocked on recovery of the authoritative deployed PostgreSQL schema. Guessing a schema would violate the source-of-truth rule.
