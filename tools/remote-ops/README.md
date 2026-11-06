# Owner-hosted remote operations gateway

Experimental. Replaces the **hosted RDC relay**, with no relay account or credit
meter. Supports any registered stdio MCP backend, locally or through OpenSSH.
The gateway uses MCP Streamable HTTP for ChatGPT and other remote MCP clients.
It does not yet establish deployed service, ChatGPT sign-in or device acceptance.

## What is implemented

- A loopback-only HTTP MCP server with HTTPS resource identity.
- RS256 OIDC token verification: issuer, audience, expiration, issued-at,
  allowed subject and `remoteops:use` scope.
- OAuth protected-resource metadata for a configured authorization server.
- Per-device tool namespaces and explicit tool allowlists enforced on calls.
- Sanitized backend environment; no client token forwarded to an agent.
- Bounded HTTP request size, concurrent request count and tool wait time.
- No automatic invocation retry. Lost completion is `OUTCOME_UNKNOWN`.

## What remains separate

An authorization server (for example self-hosted Keycloak), HTTPS reverse proxy,
SSH enrollment and device-local MCP engines must be installed and tested. This
package does not implement an OAuth authorization server. A bearer secret alone
is not presented as a complete ChatGPT login integration. No existing production
ingress is changed by this package.

The existing MIT Desktop Commander **local stdio** server is an optional
compatibility engine. Never run its `remote` subcommand in this architecture.
The gateway has no dependency on that package or service. Substitute a different
stdio MCP engine when desired. GUI, Shizuku and Android accessibility capabilities
remain with their own authorized adapters; a terminal is not an Android permission.

## Install and test

Node.js 22+ is required. From this directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
cp config.example.json config.local.json
chmod 600 config.local.json
```

Edit the private configuration with your exact OIDC issuer, JWKS URL, resource
URL, subject and device commands. All executable paths must be absolute.
Placeholder configuration is not a working deployment. Configuration is a trusted
operator input; never let an AI tool call alter it.

```sh
node gateway.mjs /absolute/path/to/config.local.json
```

The service binds `127.0.0.1:8788`; `REMOTE_OPS_PORT` selects another nonprivileged
port. TLS proxy requests must preserve the external Host. Host/Origin checks
reject arbitrary local hostnames, including an unmodified `curl localhost`.

## Terminal and device portability

Terminal-emulator choice is irrelevant to the MCP wire protocol. SSH and stdio
carry messages; each device selects its available executable/interpreter. A
remote SSH command uses the target account's shell: keep its fixed command in
trusted configuration and do not interpolate tool arguments into that command.
Linux/Android/Windows/macOS support depends on the selected backend and SSH setup;
only Linux fixture execution has been tested by this increment.

For owner interactive terminal access, retain ordinary OpenSSH separately. For
MCP process tools, explicitly add only reviewed backend tool names such as
`start_process` and `read_process_output` to that device's allowlist. The example
is read-only. An operator shell can access everything its OS account can; this
is **not a sandbox**, nor a governor for low-level Android mutations. Use a
separate nonprivileged account where an OS supports it.

## Recovery and limits

No automatic resend occurs after a tool timeout/disconnect. A failed backend
connection stays failed until gateway restart; restart does not retry commands.
Backend process sessions, cancellation, output limits, file-root confinement,
durable receipts and duplicate-command protection remain backend responsibilities.
The gateway does not provide them by proxy. All approved subjects share a single
owner trust domain; do not use this as multi-tenant hosting.

Backend stderr is suppressed to prevent command/token disclosure. Audit output
contains request UUID, subject and MCP method, never arguments or results.
An HTTP client disconnect does not prove remote cancellation. Inspect the actual
backend state before retrying. A valid token is not independent human approval.

An example systemd unit is included (`remote-ops.service`). Adjust paths and user before enabling.

See [deployment and device acceptance](DEPLOYMENT.md) and the
[architecture decision](../../docs/architecture/self-hosted-remote-ops.md).
