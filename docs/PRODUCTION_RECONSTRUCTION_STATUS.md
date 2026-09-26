# Production reconstruction status

Target: authenticated gateway -> provider-neutral PostgreSQL -> worker -> Kali.

Execution guarantee: command-type-specific; never universal exactly-once.

Required implementation sequence:

1. infrastructure
2. IAM
3. secrets
4. database migrations
5. service lifecycle
6. readiness
7. acceptance
8. rollback/recovery
9. telemetry

An artifact is complete only when an authorized automation agent can reproduce its result from canonical source and explicit prerequisites without undocumented human intervention.


## Current formalization state

The repository now has a machine-verifiable production deployment-input boundary, HTTPS readiness gate, state/migration contract, and gateway/worker service-lifecycle contract. Authoritative infrastructure identifiers, IAM policy definitions, secret references, deployed PostgreSQL schema, service commands/identities, acceptance mechanism, and rollback authority remain external inputs until recovered from production evidence.


## Source recovery result

The authoritative application repository is identified as `onnxscibroccoli/helix`, and the accepted gateway-startup worker fix is commit `38903b021cca75189a99e1ed88b508bae577f048`.

Inspection of the current Helix default branch confirms that it contains PostgreSQL migration tooling and production gateway/hypervisor code, but its database abstraction still contains historical Neon/PGlite terminology. It therefore cannot be treated as the authoritative current production database binding without revision reconciliation.

The live production PostgreSQL schema and `_helix_migrations` ledger have now been directly recovered. The numbered chain is applied in order through `0004_omnikali_tasks.sql`, and the live catalog matches the established task/workspace contract. The schema-recovery gate is closed.

The remaining reconstruction gates are clean source/release reconciliation, infrastructure/IAM/service formalization, deterministic clean-host reconstruction, readiness and acceptance automation, rollback/recovery automation, and executor hardening.

A live privilege hardening finding is also recorded: the `helix` database role is non-superuser but broader than the intended least-privilege boundary. This must be handled as a controlled compatibility-tested change, not an ad hoc production edit.

See `docs/PRODUCTION_LIVE_EVIDENCE.md`, `docs/PRODUCTION_RUNTIME_RECONCILIATION.md`, and `docs/AUTHORITATIVE_SOURCE_RECOVERY.md`.
