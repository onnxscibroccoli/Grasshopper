# Overlays live-pin import path

Status: **live-pin evidence populated in Grasshopper; executor_lineage remains blocked; Helix import not yet performed.**

## Purpose

Canonical Grasshopper holding area for **byte-identical LIVE** production overlays that are absent from Helix acceptance pin `38903b021cca75189a99e1ed88b508bae577f048` (tag `clean-reconstruction-38903b0`).

Tree: `reference/production/overlays/live-pin/`  
Machine-readable: `reference/production/overlays/live-pin/MANIFEST.json`

## Digests (LIVE authority)

| Artifact | SHA-256 | Size | Runtime path |
| --- | --- | --- | --- |
| `omni-agent.mjs` | `ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d` | 4040 | `/opt/helix/production/agent/omni-agent.mjs` |
| `agent-executor.mjs` | `6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e` | 910 | `/opt/helix/production/gateway/state/agent-executor.mjs` |

Grasshopper hardening delta (`ffd3d598…` / `d1ad94d9…` in `reference/production/deployed/` and `src/production/`) is **not** live and does **not** close G1.

## Helix import (next, separate)

Only from tag `clean-reconstruction-38903b0`, adding:

- `production/agent/omni-agent.mjs`
- `production/gateway/state/agent-executor.mjs`

when contents SHA-match the LIVE digests above. Do not invent Helix history for host-only SHAs.

## Gates

`executor_lineage` stays **blocked** until Verify Gate ACCEPT on a dated package that includes this live-pin evidence **and** remaining provenance checklist items. BRIDGE_RECOVERY “reconciliation resolved” ≠ unblock.

See `docs/PRODUCTION_EXECUTOR_LINEAGE_GATE.md` and Executor PR #35.
