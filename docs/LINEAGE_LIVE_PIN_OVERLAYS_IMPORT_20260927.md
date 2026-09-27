# Lineage live-pin overlays import — 2026-09-27

Agent: Lineage Overlays (Atom 2). Zone: America/New_York (ET).

## What landed

- `reference/production/overlays/live-pin/omni-agent.mjs` — LIVE digest `ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d` (4040 B)
- `reference/production/overlays/live-pin/agent-executor.mjs` — LIVE digest `6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e` (910 B)
- `reference/production/overlays/live-pin/MANIFEST.json` — fail-closed ledger
- `scripts/validate-live-pin-overlays.mjs` / `npm run validate:live-pin-overlays`
- Companion ledger: `reference/production/overlays/atom2-sha-ledger-20260927.md`

## What this does / does not claim

- **Does:** satisfy G1’s live-pin import condition (byte-identical LIVE evidence tree in Grasshopper).
- **Does not:** flip `executor_lineage` (remains blocked). Does not invent Helix Git history. Does not overwrite production. Does not replace Grasshopper hardening delta under `reference/production/deployed/` or `src/production/`.

## Provenance

Bytes recovered from historical Grasshopper commits that match documented LIVE digests:

- omni-agent: `709a107c52cf055e59d7e4038dac1562fe277ae5`
- agent-executor: `c1d428a29f999fd5b97087c1789feb6a1ba012bf`

Live host was **not** re-read this run. Host-only SHAs remain absent from Helix GitHub and must not be fabricated as Helix history.

Helix accepted tip `38903b021cca75189a99e1ed88b508bae577f048` / tag `clean-reconstruction-38903b0` still lacks both artifacts until a separate Helix import PR (only when bytes SHA-match LIVE).

## Verify Gate

Required before any COMPLETE claim for executor lineage.
