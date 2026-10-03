# Grasshopper OCI Security MCP

A fail-closed MCP server for authorized security operations on the Grasshopper OCI workstation.

## Security boundary

- Local mode is intended for the OCI workstation itself.
- Remote SSH mode requires an explicit host, user, private key, and known_hosts file.
- SSH uses batch mode, strict host-key checking, no agent forwarding, and no forwarding.
- No arbitrary shell tool exists.
- Read-only checks are exposed individually.
- Write actions require confirm=true.
- Every action is audit-recorded under ~/.grasshopper/audit/oci-security.
- Privileged actions use sudo -n and therefore fail closed when non-interactive sudo is unavailable.
- No credentials are stored in the repository.

## Current tools

Read-only:
- oci_status
- oci_firewall_status
- oci_ssh_hardening_check
- oci_security_updates
- oci_fail2ban_status
- oci_audit_tail

Explicit writes:
- oci_security_updates_apply
- oci_fail2ban_restart

The write tools are intentionally narrow. Firewall mutation and arbitrary root shell are not exposed.

## OpenClaw

The OCI workstation is configured with this MCP as:

grasshopper-oci-security -> stdio -> mcp/oci-security/server.mjs

The OpenClaw operator approval mode is prompt.

## Privilege state

The current grasshopper operator does not have non-interactive sudo. Therefore privileged actions currently return a controlled authorization failure rather than prompting for a password or bypassing policy.

The next hardening step is a root-installed /etc/sudoers.d/ policy granting only root-owned wrapper commands used by this MCP. Oracle Linux documents /etc/sudoers.d/ as the supported per-user authorization mechanism and recommends least privilege.

