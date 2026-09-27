# Production executor lineage gate

Status: **unresolved**.

Gate: `executor_lineage = blocked` (fail-closed). Do **not** treat this document as COMPLETE. Do **not** claim universal exactly-once from the production bridge.

Inventory date: 2026-09-27 (America/New_York). Companion inventory: [`docs/EXECUTOR_LINEAGE_EVIDENCE_GAPS_20260927.md`](./EXECUTOR_LINEAGE_EVIDENCE_GAPS_20260927.md).

## Observed artifacts

The accepted production-fix revision `38903b021cca75189a99e1ed88b508bae577f048` (Helix tag `clean-reconstruction-38903b0`) does not contain the production runtime artifacts:

- `production/gateway/state/agent-executor.mjs`
- `production/agent/omni-agent.mjs`

GitHub code search of the authoritative `onnxscibroccoli/helix` repository found no indexed source for either filename, nor for the observed `guest-exec` implementation.

The live host remains the authoritative evidence for what is actually deployed, but not for source lineage. Do not invent Helix git history for host-only SHAs.

## Live pin vs Grasshopper hardening delta (explicit split)

| Class | Role | Paths | Digests |
|-------|------|-------|---------|
| **LIVE pin (authority)** | Required match target for G1 close and any future lineage unblock | Live host: `/opt/helix/production/agent/omni-agent.mjs`, `/opt/helix/production/gateway/state/agent-executor.mjs`. Import target in Grasshopper: `reference/production/overlays/live-pin/` (+ `MANIFEST.json`) | omni-agent `ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d` (4040 B); agent-executor `6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e` |
| **Grasshopper hardening delta** | Intentional local hardening; **does not** close G1 | `reference/production/deployed/*.mjs` and `src/production/*.mjs` (same bytes today) | omni-agent `ffd3d5981cb8cc749cb112d312018b119c95e5613376f1695c59e226aed9b349` (4223 B); agent-executor `d1ad94d942ebfd0898c79a18d649b5628bb7a31ce10cdbaf01cf57e4353758c2` |

Do **not** rename Grasshopper hashes as live. Do **not** replace live hashes with Grasshopper hashes (or vice versa) without Ian.

## G1 — closes ONLY via byte-identical LIVE import

G1 is **not** closed by documenting the delta, labeling validators, or keeping hardening digests in `deployed/` / `src/`.

**Close condition (Lineage ownership, locked):** populate `reference/production/overlays/live-pin/` **only** with byte-identical LIVE blobs whose SHA-256 match the live pin digests above, plus `MANIFEST.json` recording those LIVE SHAs. Until that tree holds verified live bytes, G1 remains open.

**Current tree state (2026-09-27 update):** LIVE blobs are present under `reference/production/overlays/live-pin/` and SHA-match the LIVE pin digests (see `MANIFEST.json` and `docs/OVERLAYS_LIVE_PIN_IMPORT.md`). The sidecar-vs-`deployed/*.mjs` mismatch remains: `deployed/` / `src/` still hold the Grasshopper hardening delta (`ffd3d598…` / `d1ad94d9…`), which must not be renamed as live. G1 live-byte *presence* in the live-pin tree is satisfied for Grasshopper evidence; `executor_lineage` remains **blocked** until Verify Gate ACCEPT on the full provenance package (Helix import + remaining checklist). Do not treat live-pin alone as gate COMPLETE.

SHA ledger (Lineage-owned, outside this PR tree): `/workspace/lineage-dept-evidence/atom2-sha-ledger-20260927.md`. Lineage Dept owns that ledger path and the live-pin import procedure.

Validators that expect `ffd3d598…` / `d1ad94d9…` prove Grasshopper-tree consistency only — they do not prove match to live production.

## Owned import path (Lineage Dept)

1. **Live-pin evidence tree:** `reference/production/overlays/live-pin/` (+ `MANIFEST.json`) — populate **only** with byte-identical LIVE artifacts. Empty/absent until live capture. Do not invent stub blobs that fail the live digests.
2. **Hardening delta (already in tree):** keep `src/production/*` and current `reference/production/deployed/*` labeled as Grasshopper-local hardening (`ffd3d598…` / `d1ad94d9…`).
3. **Helix import:** PR onto Helix **only** from tag `clean-reconstruction-38903b0` (accepted tip `38903b021cca75189a99e1ed88b508bae577f048`) adding `production/agent/omni-agent.mjs` + `production/gateway/state/agent-executor.mjs` when contents SHA-match LIVE digests. No backdating; no claiming host-only SHAs as GitHub Helix history.
4. **G6 honesty:** BRIDGE_RECOVERY “reconciliation resolved” ≠ gate unblock while pin + this gate say blocked and bytes diverge.

## G6 — Bridge recovery narrative does not unblock this gate

[`docs/PRODUCTION_AGENT_BRIDGE_RECOVERY.md`](./PRODUCTION_AGENT_BRIDGE_RECOVERY.md) may say exact artifact reconciliation resolved and that canonical source designation remains gated. That headline does **not** unblock `executor_lineage` while:

- `reference/production/helix-lineage-pin.json` → `gates.executor_lineage: "blocked"`;
- this gate document remains Status **unresolved** / `executor_lineage = blocked`;
- and live vs tree bytes diverge (G1).

Keep fail-closed. Coordinate with Lineage Dept before any claim increase.

## Accepted Helix tip still missing both artifacts

Accepted Helix tip `38903b021cca75189a99e1ed88b508bae577f048` / tag `clean-reconstruction-38903b0` still lacks both:

- `production/gateway/state/agent-executor.mjs`
- `production/agent/omni-agent.mjs`

(see also `acceptance_tree_gaps` in the lineage pin).

## Host-only commits are not GitHub Helix clean release lineage

Host-only commits such as `357121db9496c6782c945499eaf3c90ea5ed9660` and `46ba4b71158a74db5ede97e300099370792ecff8` (listed under `production_host_only_shas_not_in_helix_github` in the pin) are **not** GitHub Helix clean release lineage. They must not be cited as unblock evidence for `executor_lineage`. Do not invent Helix history from them.

## Current consequence

Neither artifact may be promoted into the reproducible release merely because it exists on production.

Before promotion, an authorized workflow must establish one of:

1. a Git commit containing the exact **LIVE** artifact (via the live-pin import path above);
2. a release/build artifact whose contents hash exactly matches the deployed LIVE SHA-256;
3. documented production-local source with explicit ownership and a controlled import into the canonical source repository.

The same rule applies to the gateway launcher and systemd drop-in.

## Required evidence

For each production-only artifact:

- exact bytes or deterministic source;
- SHA-256;
- originating commit/release, if available;
- dependency list;
- runtime configuration references;
- service lifecycle dependency;
- security boundary;
- acceptance evidence;
- rollback strategy.

No secrets or credential values may be imported into source or evidence.

**Verify Gate** (Lineage / Acceptance coordination) is required before any COMPLETE claim for executor lineage.

## Executor hardening implication

The observed `omni-agent` bridge currently provides command execution through QEMU guest-agent. It is not itself evidence of durable operation idempotency or cancellation fencing.

Therefore the existing Grasshopper executor hardening contract remains necessary. The control plane must not infer external exactly-once side effects from the presence of the production bridge.

## Gate

`executor_lineage = blocked` until exact source/build provenance is recovered via LIVE-byte import (not via hardening-delta documentation alone).

Production mutation remains disabled.

Do not flip `reference/production/helix-lineage-pin.json` `gates.executor_lineage` (or related gates) to unblocked from this inventory alone.
