# Provider-Neutral Agent Sandbox

Status: architecture contract
Date: 2026-09-29

OmniKali's autonomous-agent safety model must not depend on AWS Organizations or any single cloud provider.

## Invariant

agent runtime -> dedicated sandbox tenancy -> provider identity -> provider-native guardrails -> disposable workload

Production is a separate trust domain and is reachable only through protected CI/CD.

A tenancy may be an AWS account, OCI compartment/tenancy, GCP project, Azure subscription/resource group, or equivalent provider boundary.

## Provider selection

- AWS: existing production provider; standalone-account sandbox is valid. AWS Organizations/SCPs are optional defense-in-depth.
- OCI: preferred free-first candidate for persistent compute because Oracle documents Always Free compute, storage, networking, secrets, monitoring and database resources.
- GCP: strong lightweight candidate because projects are isolation boundaries and eligible Free Tier includes an e2-micro VM.
- Azure: supported by the same adapter contract when a suitable free/credit-backed sandbox is available.
- Cloudflare: useful for edge/control-plane components; not a free persistent VM replacement under its current container pricing.

## Launch gate

A provider becomes an accepted agent sandbox only after the same tests pass:

1. sandbox identity is proven
2. production identity is distinct
3. workload creation succeeds
4. workload destruction succeeds
5. production credential acquisition/role assumption fails
6. cleanup is bounded by owner and expiry
7. production health/inventory remains unchanged
8. evidence records provider, tenancy ID, region, identity, Git SHA, resource IDs and timestamps
9. no secret material enters evidence

## Cost boundary

Free-tier eligibility is not a security boundary. Every provider adapter must enforce ownership, expiry, resource ceilings, cleanup, and a production-identifier rejection check.

## IaC ownership

Provider-specific IaC remains authoritative within its tenancy. CDK is authoritative for AWS only. Terraform/OpenTofu or native IaC may own another provider. Ansible owns host configuration. Helix owns workspace lifecycle. Kubernetes remains a separate prototype.

No two controllers own the same resource.

## Production

Agents never receive production credentials. Production changes remain:

agent -> branch -> PR -> CI -> protected environment -> short-lived federation -> production deployment

This contract lets OmniKali reach launch readiness without requiring an AWS Organization.
