# Helix ↔ Grasshopper lineage merge strategy (Atom 4)

**Status:** proposed strategy + evidence — **not COMPLETE**; no cutover; no gate flip  
**Date:** 2026-09-27 (ET)  
**Companion evidence:** `docs/LINEAGE_ATOM4_MERGE_EVIDENCE_20260927.md` (repo) / `/workspace/atom4-merge-strategy/EVIDENCE.md` (workspace pack)  
**Pin:** `reference/production/helix-lineage-pin.json` + `docs/HELIX_RELEASE_LINEAGE_PIN.md`  
**Executor gate:** `docs/PRODUCTION_EXECUTOR_LINEAGE_GATE.md` (`executor_lineage=blocked`)

This document defines how clean Helix source, dirty production runtime evidence, Grasshopper hardening deltas, migration bytes, overlays, and tags interact. It does **not** authorize production mutation, Neon-as-prod, credential rotation, AWS/RDS live change, or live Helix smoke.

---

## 1. Source-of-truth hierarchy (fail-closed)

Order is strict. A lower tier never overrides a higher tier without Ian + Verify Gate.

| Rank | Tier | What it is | What it is not |
| --- | --- | --- | --- |
| 1 | **Clean Helix pin** | Commit `38903b021cca75189a99e1ed88b508bae577f048` on `onnxscibroccoli/helix`; annotated tag `clean-reconstruction-38903b0` (tag object `6ef4db85…`) | Not Helix `main` alone (`d632064…` is 4 ahead / 28 behind per pin; not a descendant of the pin) |
| 2 | **LIVE production bytes** | Host paths `/opt/helix/production/agent/omni-agent.mjs`, `/opt/helix/production/gateway/state/agent-executor.mjs` with digests `ee0a9898…` / `6c6346ae…` | Not Grasshopper `deployed/` / `src/production/` delta digests |
| 3 | **Grasshopper live-pin overlay** | `reference/production/overlays/live-pin/` + `MANIFEST.json` (Atom 2 / PR #39) — byte-identical LIVE import only | Not present on `main` until #39 merges; never invent stub blobs |
| 4 | **Grasshopper hardening delta** | `reference/production/deployed/*` + `src/production/*` digests `ffd3d598…` / `d1ad94d9…` | Not LIVE; does **not** close G1 |
| 5 | **Dirty deployed checkout SHA** | `46ba4b71158a74db5ede97e300099370792ecff8` and other host-only SHAs | Not GitHub Helix clean release lineage; do not invent Helix history from them |
| 6 | **Migration evidence copies** | Helix checkout hashes (pin) vs Grasshopper `helix-accepted/migrations/` vs live ledger (`observed-db-baseline.json`) | Grasshopper copies are **not** authoritative Helix source |
| 7 | **Narrative recovery docs** | e.g. BRIDGE_RECOVERY “reconciliation resolved” | Never unblocks gates alone (G6) |

**Neon** is never a production source of truth.

---

## 2. What merges vs overlay-only

### Merge into Helix (clean lineage) — only when READY

| Artifact | Merge path | Preconditions |
| --- | --- | --- |
| `production/agent/omni-agent.mjs` | PR onto Helix **from** tag `clean-reconstruction-38903b0` / pin `38903b0…` | Bytes SHA-match LIVE `ee0a9898…` (4040 B); no backdating; no claiming host-only SHAs as prior Helix history |
| `production/gateway/state/agent-executor.mjs` | Same Helix import PR | Bytes SHA-match LIVE `6c6346ae…` (910 B per PR #39 MANIFEST) |
| Numbered migrations `0001`–`0004` | Already on pin; reconcile **bytes** before treating Grasshopper copies as equal | Helix checkout hashes win for “accepted source”; live ledger drift remains a gate |

### Overlay-only in Grasshopper (do not pretend they are Helix main)

| Artifact | Location | Merge into Helix `main`? |
| --- | --- | --- |
| LIVE pin blobs | `reference/production/overlays/live-pin/` | Only via separate Helix import off clean tag after Verify Gate — never by rewriting Helix `main` alone |
| Hardening delta | `deployed/` + `src/production/` | **No** as “live”; may remain Grasshopper-local until Ian decides promotion of **LIVE** bytes, not delta bytes |
| systemd / launcher reference units | `reference/production/deployed/*.service*`, launcher script | Overlay/reference until lifecycle + acceptance evidence; exact LIVE match required before clean-host claim |
| Secrets Manager drop-ins / loaders | Grasshopper + reference deployed | Contract in repo; live cutover is a separate OPEN gate — **no rotate** from this strategy |

### Never merge / never overwrite

- Blind overwrite of live production checkout with Helix `main` or dirty host tip.
- Promoting Grasshopper hardening digests as LIVE.
- Treating host-only commits (`46ba4b7…`, `357121d…`, …) as GitHub Helix history.
- Using Neon as production persistence.
- Flipping `gates.*` to unblocked from docs-only PRs.

---

## 3. Migrations × overlays × tags interaction

```
clean-reconstruction-38903b0  →  commit 38903b0…
        │
        ├── migrations/0001–0004   (authoritative accepted SOURCE bytes per pin)
        ├── helix-gateway.mjs      (pin commit touch)
        └── ABSENT: omni-agent.mjs, agent-executor.mjs
                │
                ▼
        LIVE overlays (G1)  →  Grasshopper live-pin/  →  future Helix import PR
                │
                ▼
        dirty host checkout 46ba4b7…  = runtime evidence only
```

| Concern | Rule |
| --- | --- |
| **Tags** | Prefer reconstructing from tag `clean-reconstruction-38903b0`. Pin JSON `tags_containing` now includes that tag (PR #42 @ `3ddd9c4`) — honesty only, **not** an unblock. |
| **Overlays** | LIVE overlays close **evidence** gap G1 when on tree with matching MANIFEST; they do **not** alone set `executor_lineage=unblocked`. |
| **Migrations** | Triple compare: Helix pin hashes ↔ Grasshopper evidence ↔ live ledger. `0002`/`0003` aligned; `0001`/`0004` drift remains OPEN. Do not “fix” live by overwriting DB from Grasshopper copies without Ian-gated procedure. |
| **Hardening delta** | Parallel track: keep labeled; validators that pin `ffd3d598…`/`d1ad94d9…` prove tree consistency only. |

---

## 4. Conflict decision matrix

| Conflict | Prefer | Reject / park |
| --- | --- | --- |
| Helix `main` tip vs pin `38903b0` | Pin (+ tag) for clean reconstruction | Using `main` alone |
| LIVE digest vs Grasshopper `deployed/` digest | LIVE for G1 / Helix import | Relabeling delta as live |
| Sidecar `omni-agent.sha256` (live claim) vs checked-in `.mjs` (delta) | Treat as inconsistency; keep gate blocked | “Close enough” merge |
| Host-only SHA vs missing GitHub object | Document as host evidence | Invent Helix commits |
| Grasshopper migration copy vs Helix checkout hash | Helix checkout for accepted SOURCE | Silent replace of Helix with Grasshopper banner/newline variants without note |
| Live migration ledger hash vs Helix checkout | Record drift; block clean_release / reconstruction | Assert identity without reconcile |
| BRIDGE_RECOVERY “resolved” vs pin `executor_lineage=blocked` | Pin + LINEAGE_GATE win | Narrative unblock |
| Atom 2 live-pin PR (#39) vs unmerged `main` | Strategy assumes #39 (or equivalent) lands before Helix import | Helix import before LIVE bytes exist in Grasshopper evidence tree |
| Secrets cutover OPEN vs historical #16 success | Keep `production_secrets_cutover` OPEN until fresh Ian-gated re-verify | Claiming COMPLETE from old notes |

---

## 5. Explicit non-goals

- No COMPLETE / ready-for-prod claim from Atom 4.
- No production overwrite, no live Helix checkout edit, no live smoke.
- No AWS/RDS/IAM live mutation; no credential rotate/delete/create.
- No Neon-as-production.
- No inventing SHAs, tags, or Helix history.
- No secrets in commits/docs.
- No flipping `helix-lineage-pin.json` gates to unblocked in this atom.
- No shipping Helix gateway source into Grasshopper.
- No giving Grok an executor/adapter (see `docs/GROK_HELIX_GATEWAY_WIRING.md`).

---

## 6. Recommended merge sequence (safe order)

1. **Honesty refresh (docs/data):** ~~update Grasshopper pin `tags_containing`~~ **DONE** on main via PR #42 (`3ddd9c4`, VG ACCEPT post-land). Keep pin/docs aligned if tags change; not an unblock.
2. **Land Atom 2 live-pin evidence** (PR #39 or successor) on Grasshopper `main` with verified LIVE digests + MANIFEST; keep `executor_lineage=blocked`.
3. **Keep hardening delta labeled** separate; do not overwrite live-pin with delta or vice versa without Ian.
4. **Migration reconcile plan** (read-only compare + Ian-gated apply procedure later): document `0001`/`0004` drift; do not mutate live DB here.
5. **Helix import PR** off `clean-reconstruction-38903b0` adding LIVE-matching `omni-agent.mjs` + `agent-executor.mjs` only.
6. **Clean-host dry-run / reconstruction** (adjacent PR #40 track) against pin+overlays — still no prod overwrite.
7. **Acceptance scenarios** (`docs/LIVE_ACCEPTANCE.md` harness) + secrets cutover re-verify — Ian-gated.
8. **Verify Gate ACCEPT** before any COMPLETE / gate flip / cutover.

---

## 7. Ian-gated verification checklist (before cutover)

Do **not** run against production until Ian explicitly gates. Checkboxes are procedure, not claims of completion.

### A. Lineage identity

- [ ] Helix tag `clean-reconstruction-38903b0` still points at `38903b021cca75189a99e1ed88b508bae577f048`
- [x] Grasshopper pin `tags_containing` matches live Helix tags (PR #42 @ `3ddd9c4`)
- [ ] Helix `main` not used alone as reconstruction source
- [ ] No host-only SHA cited as GitHub Helix history

### B. Overlay / executor bytes

- [ ] `reference/production/overlays/live-pin/omni-agent.mjs` SHA-256 = `ee0a9898…` (4040 B)
- [ ] `reference/production/overlays/live-pin/agent-executor.mjs` SHA-256 = `6c6346ae…` (910 B)
- [ ] MANIFEST.json agrees; class remains LIVE_pin_authority
- [ ] Hardening delta still distinct (`ffd3d598…` / `d1ad94d9…`) and not relabeled live
- [ ] Helix import tree (if merged) SHA-matches LIVE, not delta

### C. Migrations

- [ ] Helix pin hashes for `0001`–`0004` re-verified from Helix checkout
- [ ] Live ledger vs pin drift explicitly accepted or reconciled under Ian procedure
- [ ] No Grasshopper-only migration invented as production schema

### D. Gates / safety

- [ ] `npm run validate:helix-lineage-pin` PASS
- [ ] `executor_lineage` unblocked **only** after Verify Gate ACCEPT (not from this doc)
- [ ] `production_mutation_allowed` remains false until Ian + rollback evidence
- [ ] No secrets in tree; no Neon production dependency
- [ ] Secrets cutover re-verify doc satisfied if claiming SM injection live
- [ ] Live acceptance scenarios recorded COMPLETE with dated evidence (not starter OPEN)
- [ ] Backup retention / clean-host gates addressed per readiness verifier (still expected OPEN today)

### E. Cutover stop conditions (abort)

- Any LIVE vs import digest mismatch
- Attempt to overwrite dirty prod checkout without rollback package
- Request to use Helix `main` alone or Neon as prod
- Any credential value appearing in a PR diff

---

## 8. Ownership

| Concern | Owner |
| --- | --- |
| Clean pin / tag / Helix import off tag | Lineage Dept |
| LIVE byte capture → `overlays/live-pin/` | Lineage Dept (Atom 2 path) |
| `executor_lineage` gate honesty / fencing tests | Executor Dept |
| Live acceptance scenario evidence | Acceptance Dept |
| Secrets cutover re-verify | Secrets Dept |
| Verify Gate ACCEPT / COMPLETE | Ian + Verify Gate (not Atom 4 alone) |
