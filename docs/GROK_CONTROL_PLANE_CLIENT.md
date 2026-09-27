# Grok control-plane client

Grok is an authenticated client of the OmniKali control plane. It is not an execution environment and it is not a second gateway.

## Path

```
Grok session
  -> GrokControlPlaneClient
  -> ControlPlane task identity, cancellation, and audit events
  -> existing executor owned by the control plane
```

The client constructor rejects an `executor` or `adapter` argument. It cannot call the recovered agent bridge, libvirt, or a guest directly.

## Identity

A Grok operation is durably addressed by:

`grok:<principalId>:<grokSessionId>:<clientOperationId>`

Retrying the same triple returns the existing task and does not dispatch again. A different session or operation id is a different task. Cancellation uses the same triple and is acknowledged only by the control plane's executor boundary.

The returned guarantee is `control-plane-ownership-only`. That is ownership fencing and duplicate blocking. It is not exactly-once external side effects.

## Authentication and audit

The client does not read secret payloads. Callers supply an authenticator and a credential reference of one of these forms:

- `secret-manager:<name>`
- `arn:aws:secretsmanager:<name>`
- `env:<NAME>`

`env:<NAME>` is a variable name, not a value. Presented proofs, tokens, passwords, cookies, and authorization material are inputs to the authenticator only. They are not written to task records or audit events.

Accepted, duplicate, denied, and cancellation attempts append `grok.operation.accepted`, `grok.operation.denied`, or `grok.cancel.requested` through `ControlPlane.recordAudit`.

## Persistence

This client does not choose a database provider. The reference control plane continues to use its existing state store. Production durability remains provider-neutral PostgreSQL behind Helix. Neon is not a production dependency.

The client does not change the validated production task lifecycle, lease recovery, or the recovered QEMU execution primitive. Wiring it to the live Helix gateway still requires the existing authenticated gateway boundary and is not done here.

## MCP tool surface

A thin MCP facade in `src/mcp/grok-control-plane-tools.mjs` exposes exactly two tools, both of which forward to `GrokControlPlaneClient`:

- `omnikali_submit_operation`
- `omnikali_cancel_operation`

The facade rejects `executor` and `adapter` options the same way the client does. It does not import or construct an executor. Unknown tool names return `{ accepted: false, reason: "unknown_tool" }`.

## `.grok` skill

The skill at `.grok/skills/omnikali-control-plane/SKILL.md` documents that Grok must use this authenticated path and must not bypass Helix. It points back to this document.
