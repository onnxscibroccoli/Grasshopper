---
name: omnikali-control-plane
description: Route Grok OmniKali operations only through the authenticated control-plane client and MCP tools; never bypass Helix or accept an executor.
---

# OmniKali control-plane path for Grok

Grok is an **authenticated OmniKali client**. It is not an execution environment and it must not become a second gateway.

## Required path

Use only:

1. `GrokControlPlaneClient` (`src/clients/grok-control-plane-client.mjs`), or
2. The MCP tool facade (`src/mcp/grok-control-plane-tools.mjs`) that exposes:
   - `omnikali_submit_operation`
   - `omnikali_cancel_operation`

Both routes talk **only** to the OmniKali control plane. Do not call an executor, recovered agent bridge, libvirt, or guest directly. Do not bypass Helix.

## Credentials

Pass **credential references** only (`secret-manager:…`, `arn:aws:secretsmanager:…`, or `env:NAME`). Never put secret payloads, tokens, passwords, cookies, or authorization material into task records, tool schemas, or source.

## Guarantee

Responses report `guarantee: "control-plane-ownership-only"`. That is ownership fencing and duplicate blocking. It is **not** exactly-once external side effects.

## Persistence

PostgreSQL behind Helix remains production persistence. This skill does not select a database provider. Neon is not a production dependency.

## Reference

See [`docs/GROK_CONTROL_PLANE_CLIENT.md`](../../../docs/GROK_CONTROL_PLANE_CLIENT.md) for identity, audit, and persistence details. The live Helix gateway wiring **plan** (Grok → ControlPlane-shaped boundary → Helix `taskDispatch`, no executor for Grok) is in [`docs/GROK_HELIX_GATEWAY_WIRING.md`](../../../docs/GROK_HELIX_GATEWAY_WIRING.md) and is **not claimed deployed** by this skill.
