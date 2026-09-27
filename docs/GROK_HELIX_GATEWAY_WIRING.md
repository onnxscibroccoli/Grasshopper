# Grok ↔ Helix gateway wiring plan

Status: **documented plan only — not deployed, not claimed live.**

This document describes how authenticated Grok traffic should reach the live Helix gateway without weakening executor fencing. It does **not** authorize production mutation, SSM/RDS changes, a live Helix checkout edit, or an Ian-gated smoke run. Grasshopper does **not** contain Helix gateway source; the accepted Helix reference remains `onnxscibroccoli/helix` at `38903b0` (see `docs/HELIX_RELEASE_LINEAGE_PIN.md`).

Atom 1 delivered `GrokControlPlaneClient`, the MCP submit/cancel facade, and the `.grok` skill against a ControlPlane-shaped boundary. Nothing in Grasshopper today imports that client into Helix. This Atom documents the required path and acceptance design for a future gated slice.

## Required path

```
Grok session
  -> GrokControlPlaneClient (or MCP omnikali_submit_operation / omnikali_cancel_operation)
  -> ControlPlane-shaped boundary (createTask / cancelTask / recordAudit / registerAgent / store.load)
  -> Helix taskDispatch (idempotency_key derived from grok operationKey)
  -> existing executor owned by Helix (createAgentExecutor inside Helix — NEVER given to Grok)
```

Hard rules:

- Grok **never** receives an `executor` or `adapter`. `GrokControlPlaneClient` already rejects those constructor options; any future Helix-facing glue must do the same.
- Grok **never** calls the recovered agent bridge, libvirt, or a guest directly.
- Helix owns dispatch → TaskStateStore → `createAgentExecutor`. Grasshopper must not re-implement that chain or ship Helix gateway source.
- Helix `.grok/*` app/PWA skills are unrelated and must not be treated as this control-plane path.

## Operation identity mapping

| Grok / ControlPlane | Helix |
| --- | --- |
| `operationKey` = `grok:<principalId>:<grokSessionId>:<clientOperationId>` | `idempotency_key` (same string) |
| `principalId` from authenticator | principal / owner fields on the Helix task payload (from OIDC / authenticator — not invented by Grok) |
| `origin.kind: "grok"` + session/op ids | preserved on the ControlPlane-shaped task record; Helix payload must carry enough to prove ownership |
| Cancel via `GrokControlPlaneClient.cancel` → `controlPlane.cancelTask` | Helix cancel path only (no direct executor stop from Grok) |

Retrying the same `grok:…` triple must return the existing durable task and must **not** dispatch again. A different session or client operation id is a different task. The returned guarantee remains `control-plane-ownership-only` (ownership fencing + duplicate blocking), not exactly-once external side effects.

## Config and secrets (refs only)

Live wiring must use **credential references**, never secret payloads in source, task records, or audit events. Placeholder names only (no values):

| Role | Suggested ref form |
| --- | --- |
| Grok client authenticator credential | `secret-manager:omnikali/grok-client` or `env:GROK_CONTROL_PLANE_CREDENTIAL_REF` |
| Helix OIDC / gateway auth (Helix-owned) | Helix secret-manager / env names already used by `helix-gateway.mjs` — do not duplicate values into Grasshopper |
| Optional Grasshopper→Helix transport base URL | `env:HELIX_GATEWAY_BASE_URL` (name only; no host hardcoded as “production mutate”) |
| Optional idempotency / audit topic labels | `env:GROK_HELIX_AUDIT_CHANNEL` (optional) |

Forbidden in this plan and in any follow-on implementation PR:

- Tokens, passwords, cookies, `Authorization` headers, or API keys in docs, schemas, or audit JSON.
- Hardcoding production hostnames as mutation targets.
- Reading SSM/RDS or live Helix checkout from Grasshopper CI or agent runs.

## Explicit non-goals

- **No production deploy** and no claim that live Helix already consumes `GrokControlPlaneClient`.
- **No agent-bridge / libvirt bypass** for Grok.
- **No weakening** of lease, owner, or executor fencing already enforced by ControlPlane / Helix.
- **No adapter/executor injection** into Grok constructors or MCP tool registration.
- **No expansion** of the MCP tool surface beyond `omnikali_submit_operation` and `omnikali_cancel_operation`.
- **No copy** of Helix `helix-gateway.mjs` into Grasshopper.
- **No live smoke against prod** until Ian explicitly gates Atom 3.

## Implementation notes for a future code slice (not this PR)

This PR is **docs-only**. A later Atom may add a thin Helix-facing ControlPlane-shaped adapter under `src/clients/` that:

1. Implements only `createTask`, `cancelTask`, `recordAudit`, `registerAgent`, and `store.load`.
2. Delegates to an **injected** Helix task API (fetch/dispatch interface), never imports or constructs an executor/adapter.
3. Maps `operationKey` → Helix `idempotency_key` in a unit-tested way.
4. Rejects `executor` / `adapter` constructor options the same way `GrokControlPlaneClient` does.
5. Uses injectable transport only (no production host calls from unit tests).

That code is **out of scope** here. Do not land it until Helix Lineage / Ian approve the slice and fencing tests stay green.

## Acceptance criteria — Atom 3 smoke (Ian-gated; propose only)

Do **not** run against production. When Ian gates a non-prod or explicitly authorized environment, the smoke should prove:

1. **Auth fence** — Unauthenticated submit is denied; no Helix task is created; presented proof is absent from store/audit.
2. **Happy path** — Authenticated submit with a fresh `grok:…` key creates exactly one Helix task whose `idempotency_key` equals that key; response includes `guarantee: "control-plane-ownership-only"`.
3. **Idempotent retry** — Second submit with the same triple returns `duplicate: true` and the same task id; Helix dispatch count does not increase.
4. **Cancel path** — Cancel through ControlPlane/Helix cancel only; acknowledged cancel is audited as `grok.cancel.requested` without secret material.
5. **Ownership fence** — A different principal cannot cancel or observe another principal’s grok operation.
6. **Constructor fence** — Instantiating the client (and any future Helix-facing glue) with `executor` or `adapter` throws.
7. **Non-goals hold** — No agent-bridge call, no libvirt, no Grasshopper-side executor start, no production mutate from the smoke harness.

Recommended harness shape (design only): injectable fake or staging Helix task API + in-memory ControlPlane-shaped store; record dispatch/cancel counts; assert audit JSON has credential refs only. Production hosts, SSM, and RDS remain untouched unless Ian issues a separate mutate authorization.

### Proposed Atom 3 smoke text (for Ian approval)

> Atom 3 (Ian-gated): Against a non-prod or explicitly authorized Helix staging boundary only — wire `GrokControlPlaneClient` to a ControlPlane-shaped facade whose `createTask`/`cancelTask` map `operationKey` → Helix `idempotency_key`, run the seven acceptance checks above with injectable transport, publish pass/fail evidence, and stop. No production mutate, no SSM/RDS writes, no live prod smoke, no executor handed to Grok.

## Cross-references

- Client contract: `docs/GROK_CONTROL_PLANE_CLIENT.md`
- Skill: `.grok/skills/omnikali-control-plane/SKILL.md`
- Helix accepted release pin: `docs/HELIX_RELEASE_LINEAGE_PIN.md` (`38903b0`)
- Executor / lease fencing: `docs/PRODUCTION_EXECUTOR_BOUNDARY.md`, `docs/PRODUCTION_TASK_STATE_CONTRACT.md`
