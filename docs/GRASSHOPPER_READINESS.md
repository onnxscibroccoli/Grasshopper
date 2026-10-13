# Grasshopper Readiness Report

Date: 2026-09-26
Status: NOT READY FOR FINAL HANDOFF

## Mission

Grasshopper is the pre-implementation control plane for the next OmniKali implementation project. It records the architecture, evidence, constraints, decisions, operational model, and acceptance criteria required to make the next project implementation-first rather than discovery-first.

## Verified facts

- Canonical Grasshopper repository: `onnxscibroccoli/Grasshopper`.
- Reference slice commit: `958bc472b950e6cf13e82eaef17ffd7049b01f4b`.
- Reference slice is reproducible and its five recovery/concurrency tests pass on the connected host.
- The reference slice owns desired state, identity, task lifecycle, lock ownership, and reconciliation; execution environments are adapters.
- Live implementation repository: `onnxscibroccoli/helix`.
- Live production host: EC2 device `ip-172-31-8-59`; gateway service is enabled and active.
- Production gateway environment file is `root:root`, mode 600. Its contents were not read or printed.
- OmniKali/Helix gateway state/dispatch/runner tests pass 14/14 on the connected host.
- Production AWS VPC is `vpc-03a8b25046144eb2b` in `us-east-1`.
- Dedicated private DB subnets exist in `us-east-1a` and `us-east-1b`.
- Dedicated DB security group allows TCP/5432 only from the Helix application security group.
- Dedicated RDS subnet group exists and is Complete.
- RDS instance `helix-control-plane` does not exist.
- AWS-managed PostgreSQL is the accepted production database decision (IcePanel ADR #4).
- Helix PR #12 is open/draft at head `2fcde8b6cfd6b2c50668a4ea900ad847f2b17586`.
- Terraform is not installed on the production host.
- A prior CloudFront 504 incident was traced to the stopped Kali origin; recovery required starting the origin before escalating CloudFront/networking faults.

## Inference

The Grasshopper reference is sufficiently concrete to define the implementation control-plane model, but the production database and secret/configuration binding remain incomplete. Therefore the next project can be seeded with architecture and contracts, but Grasshopper must not declare final readiness yet.

## Critical blockers

1. Create the authoritative private RDS PostgreSQL instance through an approved infrastructure path.
2. Define and validate the secret/configuration binding from the RDS-managed Secrets Manager secret to the production runtime without exposing the secret.
3. Validate the client/network path from the production gateway to private RDS.
4. Run migrations and the fail-closed PostgreSQL readiness check against the real database.
5. Verify gateway -> task state -> worker -> authenticated Kali execution against durable PostgreSQL.
6. Verify stale-worker/node-loss reconciliation against the production state store.
7. Reconcile the dirty production checkout/deployed artifact state before treating source and runtime as aligned.
8. Resolve the current implementation project's remaining environment dependencies and KMS/Vault binding questions.

## Handoff decision

Do not generate the final seed prompt yet. The architecture is substantially specified, but the production data-plane binding is still an unverified critical dependency.
