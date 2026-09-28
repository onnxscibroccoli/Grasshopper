# Full remote desktop reproducibility gate

This is the completion gate for the actual OmniKali remote desktop product.

The earlier local/reference reproducibility gate is necessary but is **not sufficient** for MVP completion.

## Required outcome

Starting from canonical source and explicit, non-secret deployment inputs, an authorized automation agent must be able to create a fresh AWS deployment that provides the same externally observable product path as the accepted production system:

```
new AWS environment
  -> EC2 hypervisor host
  -> nested KVM/libvirt
  -> persistent Kali desktop workspace
  -> XFCE + Firefox + terminal
  -> localhost-only VNC
  -> authenticated Helix gateway
  -> OIDC login and secure session
  -> dashboard/portal
  -> authenticated desktop capability
  -> WSS/RFB/noVNC
  -> usable remote desktop
```

The deployment must not depend on copying the existing production host, its dirty checkout, operator shell history, browser cookies, synthetic sessions, or plaintext credentials.

## Reproduction contract

A clean deployment run must record:

1. exact Grasshopper revision;
2. exact Helix production revision;
3. AWS region and generated resource identifiers;
4. EC2 instance type and nested virtualization state;
5. IAM instance profile and least-privilege prerequisites;
6. encrypted persistent EBS volume;
7. deterministic host bootstrap;
8. deterministic Kali base-image acquisition and integrity verification;
9. deterministic guest desktop bootstrap;
10. systemd service lifecycle;
11. gateway runtime configuration from secret references;
12. PostgreSQL migrations and readiness;
13. CloudFront/public origin configuration;
14. Cognito/OIDC configuration and callback URI;
15. dashboard readiness;
16. authenticated browser login;
17. persistent workspace ownership;
18. desktop WebSocket ticket issuance;
19. WSS -> RFB/noVNC connection;
20. Firefox and terminal availability inside the guest;
21. browser disconnect/reconnect without destroying the persistent workspace;
22. failure/recovery evidence;
23. machine-readable PASS/FAIL evidence.

## Human interaction boundary

A human may provide an AWS authorization context and perform the normal end-user sign-in if required by the identity provider.

Those are explicit inputs, not undocumented deployment steps.

The agent must perform the infrastructure, host, guest, service, configuration, readiness, and acceptance workflow without an operator manually repairing the machine.

## Fail-closed conditions

The gate MUST fail if any of these are true:

- infrastructure is only documented but not source-controlled;
- a deployment depends on a dirty production checkout;
- a required guest image is missing or unverified;
- the guest desktop is not reproducibly provisioned;
- Firefox is expected but not installed/verified;
- the persistent workspace is not durable across reconnect;
- the gateway requires manually copied secrets;
- the public dashboard cannot be reached;
- authentication cannot complete with the documented identity configuration;
- the browser receives a long-lived desktop credential;
- noVNC/VNC/libvirt/hypervisor APIs are publicly exposed;
- the desktop WebSocket cannot be established from an authenticated browser session;
- reconnect loses the workspace;
- any acceptance step requires an undocumented human shell intervention.

## Important distinction

A successful Terraform plan, EC2 boot, systemd status, or HTTP health check does **not** satisfy this gate.

The gate closes only after the complete user-visible path has been exercised.

## Current known reconstruction gaps

As of 2026-09-27:

- Grasshopper local/reference reconstruction is proven.
- The deployed AWS desktop is proven historically/live as a product path.
- The current Helix `infra/terraform` directory is not an AWS implementation. It contains OCI resources despite the AWS directory name. It cannot be used as the AWS source-of-truth deployment path.
- The AWS `user-data.sh` installs the host prerequisites and clones Helix, but does not by itself reproduce the complete gateway/database/auth/public-ingress/guest-desktop product.
- The current hypervisor service references a base guest image path, but the source tree does not yet establish a deterministic, integrity-verified build/acquisition pipeline for the exact Kali desktop guest.
- The current RDC bootstrap intentionally depends on a previously paired Desktop Commander session and therefore is not a prerequisite for the primary browser desktop path.
- Native RDS automated-backup retention is currently 1 day. This is a separate resilience constraint and must not be represented as 14-day coverage.

These are implementation gates, not reasons to redesign the validated architecture.

## Completion evidence

The final PASS artifact must contain enough non-secret evidence for another authorized agent to determine that the full path was reproduced. It must never contain passwords, OAuth client secrets, session cookies, private keys, or browser credentials.
