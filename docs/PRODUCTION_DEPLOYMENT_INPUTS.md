# Production deployment inputs

This file is the machine-readable boundary between the verified production system and reproducible deployment automation.

It intentionally contains **references and contracts, not secrets or guessed infrastructure identifiers**.

## Verified topology

- Gateway: Helix gateway
- Persistence: provider-neutral PostgreSQL
- Worker: Helix worker
- Execution environment: Kali
- Request path: authenticated client -> gateway -> PostgreSQL -> worker -> Kali
- Task lifecycle: PENDING -> RUNNING -> COMPLETED | FAILED
- Recovery: durable lease expiry and replacement-worker ownership
- Runtime database configuration: authorized secret-manager-backed runtime configuration
- Runtime configuration protection: production environment file is protected and must not be committed

## Required deployment inputs

An authorized deployment environment must supply, outside source control:

1. AWS account and region
2. Existing production VPC/network identifiers
3. PostgreSQL instance/cluster identity and connection endpoint
4. Database name and migration target
5. Secret reference used by the gateway runtime
6. IAM role identities and required policy attachments
7. Gateway service lifecycle definition
8. Worker service lifecycle definition
9. Public gateway/readiness endpoint
10. Authenticated acceptance mechanism
11. Kali worker execution target
12. Rollback and recovery authority

## Safety rules

- Do not put passwords, credential-bearing database URLs, access tokens, session cookies, private keys, browser authentication state, or secret values in this repository.
- Do not substitute a different database provider.
- Do not create a second production topology merely to make reconstruction easier.
- Deployment automation must fail closed when a required input is absent.
- Resource identifiers may be supplied through protected deployment configuration, but are not required to be embedded in application source.
- Production acceptance must exercise real state transitions and failure boundaries.

## Reproducibility contract

The eventual deployment automation must execute in this order:

source/environment -> infrastructure -> database initialization -> protected runtime configuration -> service lifecycle -> readiness -> acceptance -> rollback/recovery -> telemetry

A deployment is not reproducible merely because the application can be started locally.

## Current status

This contract is intentionally incomplete until the authoritative production infrastructure values are available to the automation environment. Filling missing values with guessed defaults is prohibited.
