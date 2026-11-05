# Self-hosted remote operations

Status: In Development. No device has migrated. No public endpoint is deployed.

## Goal and ownership

Replace the metered Desktop Commander Remote relay across the owner's Android,
OCI, Kali and other enrolled systems. ChatGPT and other MCP clients reach one
owner-hosted gateway. Grasshopper owns gateway policy and device routing;
Broccoli retains Android action authorization and its canonical Rish transport.
The gateway neither assumes root nor grants Android privileges.

## Selected architecture

A Node.js MCP gateway runs on the OCI development workstation behind dedicated
HTTPS ingress. A self-hosted OAuth/OIDC authorization server supplies scoped,
expiring tokens. Registered devices expose MCP over stdio, directly or over
OpenSSH. SSH handles host authentication, encrypted transport and reconnects.
No Desktop Commander Remote account, relay, credit check or subscription is used.

Backends are configurable MCP executables. The existing MIT local Desktop
Commander engine can be reused without its `remote` command; it is an optional
compatibility backend, not a gateway dependency. An owner can substitute another
MCP terminal/file engine without changing the gateway. This is independence from
the paid relay, not a claim that every optional backend has been reimplemented.

Alternatives considered: rebuilding every terminal and file operation would
add an unnecessary second executor; continuing the hosted relay would retain
the credit dependency. Reuse local engines behind a new self-hosted boundary.

## Security and failure contract

- Bind only to loopback. TLS and OAuth issuer configuration are explicit.
- Validate issuer, audience, expiry, subject allowlist and remoteops:use scope.
- Serve OAuth protected-resource discovery; use a real external authorization
  server such as self-hosted Keycloak, not an invented password protocol.
- Validate Host and Origin before processing requests; bound request bodies.
- Device commands and tool allowlists are owner configuration, never client input.
- Each exposed tool is namespaced by device. Unknown/unlisted tools fail closed.
- Only listed tools are reachable, including tools/call; filtering tools/list
  alone is insufficient. Default example enables read-only tools only.
- Do not forward the client's OAuth token to device processes.
- Never automatically retry a tool call after disconnect or timeout. Report
  OUTCOME_UNKNOWN; a caller must reconcile possible effects before retrying.
- The gateway is single-owner. Approved subjects share the same operator trust
  domain; it is not a tenant-isolation boundary or OS sandbox.
- Operator shell execution inherits the backend account's authority. Enabling it
  is not equivalent to enabling a narrowly authorized Android action dispatcher.
- Process recovery and durable operation deduplication depend on each backend;
  a gateway connection does not establish exactly-once execution.

## Implementation plan

1. Add a separate tools/remote-ops package with pinned MCP SDK and JOSE versions.
2. Write executable tests for authentication, tool filtering, namespaced routing,
   secret isolation and ambiguous completion before gateway implementation.
3. Implement a loopback Streamable HTTP gateway and stdio backend manager.
4. Test with an actual child MCP server and signed local test JWTs.
5. Provide host configuration, SSH examples and an OCI deployment runbook.
6. Validate each real device: initialize, list tools, inspect a harmless file,
   run an explicitly authorized harmless command, interrupt/reconnect and prove
   no replay. Only then retire that device's hosted RDC route.

## Migration acceptance

| Target | Current state | Required next proof |
| --- | --- | --- |
| Android Termux | RDC inspected; later command requests timed out | SSH/stdin backend and recovery |
| OCI workstation | RDC offline at inventory | Host access, capacity, isolated gateway |
| Kali workstation | RDC offline at inventory | Protected-system inventory, user agent |
| Other AWS host | RDC offline at inventory | Owner identification and scoped agent |
| ChatGPT | OAuth design only | Real sign-in, tool discovery and invocation |

A running gateway is not evidence that a remote terminal is usable. Keep the
existing access path until replacement evidence is captured. Deployment must
not reuse protected AWS ingress or silently expose a terminal without OAuth.
Existing hosting/network costs and AI provider limits remain separate from RDC
credits. Self-hosting removes that relay's credit dependency, not all costs.
