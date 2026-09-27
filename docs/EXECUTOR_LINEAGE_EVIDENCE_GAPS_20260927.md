# Executor lineage evidence gaps — 2026-09-27

Agent: Executor Dept (Grasshopper). Zone: America/New_York (ET).  
Repo tip at inventory: `onnxscibroccoli/Grasshopper` @ `c2927209` (origin/main).  
Canonical gate doc: [`docs/PRODUCTION_EXECUTOR_LINEAGE_GATE.md`](./PRODUCTION_EXECUTOR_LINEAGE_GATE.md).  
Pin: `reference/production/helix-lineage-pin.json` → `gates.executor_lineage: "blocked"`.

**Status remains unresolved. `executor_lineage = blocked`. No exactly-once claim. No gate flip. No invented Helix history.**

Secrets and credential values are intentionally omitted.

## Gap index (G1–G6)

| ID | Gap | Unblocks lineage? |
|----|-----|-------------------|
| G1 | Live deploy SHA still differs from hardening tree, but byte-identical LIVE overlay evidence is now imported | **Evidence import resolved; executor_lineage remains blocked by remaining gaps** |
| G2 | Accepted Helix tag exists, but the accepted pin tree itself does not contain the live executor artifacts | No |
| G3 | Host-only commits (`357121d…`, `46ba4b7…`) ≠ GitHub Helix clean release lineage | No |
| G4 | `omni-agent.mjs` was authored on host, but Grasshopper now designates the recovered bridge as canonical source | No; canonical designation is complete, provenance/reconciliation remains |
| G5 | Required evidence checklist incomplete for promotion package | No |
| G6 | `PRODUCTION_AGENT_BRIDGE_RECOVERY` “reconciliation resolved” ≠ unblock while pin + gate say blocked and bytes diverge | No |

## Live pin vs GH hardening delta

| Class | Digest (omni-agent / agent-executor) | Where |
|-------|--------------------------------------|-------|
| LIVE pin (G1 evidence import) | `ee0a9898…` (4040 B) / `6c6346ae…` | Live host paths and `reference/production/overlays/live-pin/` + `MANIFEST.json` (**present after merged PR #39**) |
| Grasshopper hardening delta | `ffd3d598…` (4223 B) / `d1ad94d9…` | `reference/production/deployed/` + `src/production/` — intentional local hardening; **does not close G1** |

`omni-agent.sha256` sidecar asserts live while checked-in `.mjs` is delta — evidence inconsistency, not unblock. G1 is blocked on obtaining live bytes (read-only capture), not on labeling the delta.

## Owned import path (cite Lineage Atom 2)

Lineage Dept owns:

- SHA ledger: `/workspace/lineage-dept-evidence/atom2-sha-ledger-20260927.md` (workspace evidence; Lineage-owned)
- Live-pin tree: Grasshopper `reference/production/overlays/live-pin/` (+ `MANIFEST.json`) — populate **only** with byte-identical LIVE blobs
- Helix import: only off tag `clean-reconstruction-38903b0` when artifact bytes SHA-match LIVE digests; no backdating; host-only SHAs are not Helix history

Executor Dept keeps `executor_lineage = blocked` and coordinates via this inventory until Verify Gate.

## Coordination

- Do not flip pin gates from this note.
- Do not claim COMPLETE or exactly-once.
- Do not treat BRIDGE_RECOVERY reconciliation language as an unblock.
