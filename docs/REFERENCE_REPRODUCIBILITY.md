# Reference reproducibility contract

The repository contains a deterministic local/reference implementation used to harden and formalize the verified OmniKali production contracts.

## Clean checkout

Requirements:

- Git
- Node.js 20 or newer
- no production credentials
- no pre-existing service dependencies

From the repository root:

    npm run bootstrap
    npm run verify:reference

bootstrap.sh is intentionally idempotent. It creates the local state directory and registers the reference agent/resource through the same CLI used by verification.

## Verification

verify-reference.sh performs:

1. bootstrap from source;
2. the complete Node test suite;
3. a CLI state/readiness invocation;
4. a filesystem-mode check on the local state file.

The state file is created with mode 0600; it is local reference state and contains no production credentials.

## Scope boundary

This contract proves reproducibility of the repository local/reference environment. It is not a claim that the production AWS/PostgreSQL/Kali deployment can already be recreated from this script.

Production reproducibility still requires explicit formalization of infrastructure, IAM, secret-manager prerequisites, migrations, service lifecycle, readiness checks, and rollback/recovery procedures described by IMPLEMENTATION_SEED.md.

No production architecture is substituted by the reference environment.
