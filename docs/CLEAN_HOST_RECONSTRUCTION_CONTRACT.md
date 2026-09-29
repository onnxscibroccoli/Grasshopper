# Clean-host reconstruction contract

This document defines the inputs required to reconstruct the reference control plane without copying production credentials.

## Required source inputs

- Helix repository and one pinned accepted source revision.
- Grasshopper reference manifests and validation scripts.
- PostgreSQL engine plus the documented database name and migration ledger.
- An authorized instance profile or equivalent identity for the target test host.
- External secret references for runtime credentials. Secret values must never enter this repository.
- Network, DNS, TLS, and firewall prerequisites recorded as infrastructure facts.

## Bootstrap sequence

1. Provision the disposable test host.
2. Install the required OS/runtime dependencies.
3. Run scripts/bootstrap.sh for the Grasshopper reference plane.
4. Apply the documented Helix bootstrap/user-data contract in the disposable environment.
5. Resolve secret references through the authorized secret provider.
6. Apply the migration ledger.
7. Run static validators and scripts/verify-clean-host-dryrun.mjs.
8. Run the authorized live acceptance only after the clean-host prerequisites are satisfied.
9. Record the acceptance ID and timestamp separately from source code.

## Explicit non-goals

- No production credentials are copied.
- No production database is used as a test database.
- No CloudFront origin is changed.
- No host ports 80/443 are claimed by the Kubernetes prototype.
- Static PASS does not imply clean-host or production COMPLETE.
