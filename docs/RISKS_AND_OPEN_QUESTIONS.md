# Known Risks and Open Questions

## BLOCKER — Production PostgreSQL does not yet exist

Observed: the RDS subnet group and network boundary exist, but `helix-control-plane` is not present.

Required: provision through an approved infrastructure path, then wait for Available and verify endpoint/network reachability.

## BLOCKER — Secret/configuration binding

Observed: application code consumes `DATABASE_URL`; RDS is designed to manage the master password in Secrets Manager.

Open: how the runtime securely retrieves or receives the connection information without putting a password in a file, prompt, repository, or deployment artifact.

## BLOCKER — Private database client path

Open: the production gateway is in AWS, but any Vercel-hosted server-side component must not assume private RDS is directly reachable. The final architecture must identify the actual caller and network path.

## BLOCKER — Production source/runtime drift

Observed: the connected production checkout contains uncommitted modifications and untracked files while `helix-gateway` is active.

Open: determine the deployed artifact/commit and reconcile intentional changes before using that checkout as deployment evidence.

## OPEN — Infrastructure authority

The connected production EC2 role previously lacked the permissions required to provision/discover all database infrastructure. The current AWS infrastructure connector has authoritative read access as the account root identity. The implementation project must establish a durable, least-privilege provisioning/deployment identity rather than relying on root.

## OPEN — KMS/Vault binding

The seed requirements require validation of active KMS/Vault bindings. No authoritative live binding has yet been recorded here.

## OPEN — Runtime dependencies

Validate required Node/Python/Go versions and Kali CLI/QEMU/libvirt dependencies on each execution class before implementation.

## OPEN — Recovery automation

The 2026-09-25 CloudFront incident proved that a stopped Kali origin can masquerade as a gateway outage. The final implementation should detect this class of failure and use an authorized, auditable recovery path.

## HANDOFF RULE

These questions must be resolved or explicitly accepted as implementation-phase gates before the final seed prompt is generated.
