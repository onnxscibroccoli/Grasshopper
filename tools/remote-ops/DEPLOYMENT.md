# OCI deployment and fleet migration

Status: prepared instructions, NOT DEPLOYED. Never uninstall an old route merely
because this gateway starts. Deployment uses the selected OCI development host;
protected AWS Helix/Kali services and ingress remain untouched.

## 1. Host prerequisites

### Example systemd unit
Copy `remote-ops.service` to `/etc/systemd/system/`, adjust `User`/`WorkingDirectory`/`ExecStart` paths, then:
```sh
sudo systemctl daemon-reload
sudo systemctl enable --now omnikali-remote-ops
journalctl -u omnikali-remote-ops -f
```
The unit binds only loopback, drops privileges, and does not touch protected ingress.

Record existing listeners, routes, services, Git state, available disk/RAM and a
restore point. Use a nonprivileged dedicated account and an isolated directory.
Install the pinned package with `npm ci --ignore-scripts`. Existing cloud charges
and domain costs are separate from the removed RDC relay credit dependency.

## 2. Identity and HTTPS

Use a self-hosted OAuth/OIDC provider, such as Keycloak, with HTTPS. Configure an
owner account, an authorization-code client with PKCE S256, exact callback URIs
from the client setup, and the `remoteops:use` scope. Add an audience mapper so
access tokens contain the exact public MCP URL. Record the owner's stable `sub`
in the gateway subjects list. Do not enable arbitrary open user enrollment.

Configure the chosen client's actual OAuth client ID/secret privately; do not
commit them. The gateway exposes protected-resource discovery at
`/.well-known/oauth-protected-resource/mcp` and expects RS256 JWT access tokens.
This design requires client compatibility verification; no live ChatGPT sign-in
has been performed. Do not switch to unauthenticated public access to make it work.

Use an isolated HTTPS virtual host (example only):

```caddyfile
ops.example.com {
    reverse_proxy 127.0.0.1:8788
}
```

Do not apply that fragment over an existing protected ingress configuration.
Port 8788 stays loopback-only. Configure TLS at a dedicated origin and verify
protected-resource and issuer discovery through that origin.

## 3. Devices and tunnels

Each device runs an owner-approved local stdio MCP engine. SSH starts it only
when the gateway connects. No paid remote relay is required. Keep host-key
checking enabled and use dedicated device identities. The local Desktop Commander
MIT server can be reused as a compatibility engine without its `remote` command;
other MCP engines are supported by the same configuration.

For Android behind NAT, use an outbound reverse SSH tunnel to OCI that binds
**only OCI loopback**, e.g. a dedicated remote port 18022 forwarding to Termux
sshd 8022. Configure the OCI SSH account with PermitListen restricted to that
loopback port and prohibit shell access for that tunnel-only key. Do not set
GatewayPorts=yes. A separate key/account is needed for gateway-to-phone login.
Verify host keys out of band before unattended use. Do not copy private keys
between machines or disable StrictHostKeyChecking.

The reverse-tunnel command template is:

```sh
ssh -NT -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=2 -R 127.0.0.1:18022:127.0.0.1:8022 oci-tunnel
```

It requires preconfigured identities and aliases; it is not run by the installer.
Use the OS service manager (Termux services, systemd user units, launchd, or a
Windows service) for startup. Do not use an endless reconnect loop that replays
commands. Android background/reboot behavior requires live verification.

## 4. Per-device acceptance and rollback

For each distinct physical system (deduplicate old RDC registrations):

1. Verify MCP initialize and expected tool names.
2. Read a deliberately created, harmless fixture file.
3. Enable and invoke an explicitly approved harmless process tool.
4. Write a test file within the approved test directory; verify its SHA-256.
5. Interrupt the connection after a recorded test side effect. Confirm unknown
   completion, no automatic replay and controlled reconnection.
6. Restart the agent/service and verify accessibility from its actual client.
7. Capture source SHA, tool versions, command/fixture IDs, receipts and limitations.
8. Only after these pass, remove that device's dependence on the hosted RDC route.

Rollback stops the new gateway/tunnel and restores the previous client config.
It does not delete files, reset repositories, remove old agents or rotate keys.
Existing RDC remains a temporary fallback until the replacement passes acceptance.

## Remaining deployment inputs

OCI SSH access, dedicated hostname/TLS route, authorization-server location,
owner subject, and verified host keys must be established. Current offline RDC
entries are not proof of reachable machines. Do not invent these values.
