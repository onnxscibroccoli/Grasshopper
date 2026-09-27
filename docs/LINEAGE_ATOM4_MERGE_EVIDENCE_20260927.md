# Atom 4 — Helix clean-source vs dirty-prod lineage evidence

**Inventory date:** 2026-09-27 (America/New_York / ET)  
**Agent:** Lineage Merge Strategy (Atom 4)  
**Grasshopper tip observed:** `c2927209daf856623bf2ff44ee44a3efd84cb2dc` (`origin/main` after pull)  
**Auth observed:** `gh` as `onnxscibroccoli` (scopes: gist, read:org, repo); GitHub MCP `get_me` → `onnxscibroccoli`  
**Status:** evidence only — **not COMPLETE**; Verify Gate required before any cutover claim

Fail-closed rules applied: only observed facts; **UNKNOWN** where not re-verified in this run; no invented Git history; no secrets.

---

## 1. Auth / tool discovery

| Check | Result |
| --- | --- |
| `gh auth status` | Logged in as `onnxscibroccoli`; protocol https; scopes `gist`, `read:org`, `repo` |
| MCP `user-Github` / `get_me` | `login=onnxscibroccoli`, id `304189395` |
| Clone path | `/workspace/Grasshopper-atom4` (workspace only; no live prod checkout) |

---

## 2. Real paths searched (hits)

### Grasshopper docs (lineage / Helix / overlays / gates)

| Path | Role (observed) |
| --- | --- |
| `docs/HELIX_RELEASE_LINEAGE_PIN.md` | Clean Helix pin narrative; fail-closed |
| `docs/PRODUCTION_SOURCE_LINEAGE_RECONCILIATION.md` | Clean vs dirty checkout; host-only SHAs |
| `docs/PRODUCTION_EXECUTOR_LINEAGE_GATE.md` | `executor_lineage=blocked`; LIVE vs hardening delta |
| `docs/EXECUTOR_LINEAGE_EVIDENCE_GAPS_20260927.md` | G1–G6 gap index |
| `docs/GROK_HELIX_GATEWAY_WIRING.md` | Grok→Helix plan; cites pin `38903b0` |
| `docs/AUTHORITATIVE_SOURCE_RECOVERY.md` | Canonical app repo = Helix; accepted SHA |
| `docs/AGENTIC_DEPLOY_READINESS.md` | Static readiness; lineage gate OPEN |
| `docs/PRODUCTION_STATE_AND_MIGRATION.md` | Migration / state (present; not fully re-read) |
| `docs/PRODUCTION_RUNTIME_DELTA_INVENTORY.md` | Runtime delta inventory (cited by ledger) |
| `docs/PRODUCTION_EXECUTOR_PROVENANCE.md` | Executor provenance (cited by ledger) |
| `docs/PRODUCTION_LIVE_EVIDENCE.md` | Live evidence (cited by ledger) |
| `docs/PRODUCTION_AGENT_BRIDGE_RECOVERY.md` | Bridge recovery; G6 honesty note |
| `IMPLEMENTATION_SEED.md` | Mentions Helix gateway live/healthy (seed context) |

### Machine-readable reference

| Path | Observed |
| --- | --- |
| `reference/production/helix-lineage-pin.json` | `status=pinned-fail-closed`; `tags_containing` includes `clean-reconstruction-38903b0` (tag object `6ef4db85…` → `38903b0…`) via PR #42 merge `3ddd9c4` |
| `reference/production/reconstruction-manifest.json` | `clean_release_lineage=blocked`; dirty deployed checkout |
| `reference/production/observed-db-baseline.json` | Live migration SHA-256s; dirty checkout `46ba4b7…` |
| `reference/production/helix-accepted/migrations/` | Evidence copies of `0001`–`0004` |
| `reference/production/deployed/` | Hardening-delta `.mjs` + sidecar `omni-agent.sha256` |
| `reference/production/overlays/live-pin/` | **PRESENT on tip** after merged PR #39 (`505113c…`) — LIVE digests + MANIFEST |

### Workspace Lineage evidence (outside repo tree)

| Path | Observed |
| --- | --- |
| `/workspace/lineage-dept-evidence/atom1-helix-tag-20260927.md` | Tag creation evidence |
| `/workspace/lineage-dept-evidence/atom2-sha-ledger-20260927.md` | LOCKED LIVE vs delta digests |
| `/workspace/lineage-dept-evidence/live-overlay-bytes/` | Present (directory listed; bytes used by Atom 2 PR) |

### Atom 2 live-pin overlay paths (landed)

PR #39 **MERGED** (`505113c1852e60f83b1f50143eca86add149c94a`, 2026-09-27T07:04:32Z). Paths on tip:

- `docs/OVERLAYS_LIVE_PIN_IMPORT.md`
- `reference/production/overlays/live-pin/MANIFEST.json`
- `reference/production/overlays/live-pin/omni-agent.mjs`
- `reference/production/overlays/live-pin/agent-executor.mjs`

Gate note: live-pin evidence does **not** flip `executor_lineage` (stays blocked).

---

## 3. Related PRs / issues (observed via `gh` / GitHub search)

### Pull requests (lineage / Helix / overlays / migrations / gates)

| # | State | Title | Head SHA | Head branch | Notes |
| --- | --- | --- | --- | --- | --- |
| 39 | MERGED | docs(lineage): live-pin overlay import | `0c29e8bba571415dd2e43e07e3ed88040070608d` | `lineage/atom2-overlays-live-pin-20260927` | Merged `505113c…`; live-pin overlay present; gate stays blocked |
| 44 | MERGED | test(acceptance): replacement completion dry-run fixtures | `6af7eac…` | `acceptance/sc-replace-replacement-completion` | Dry-run only; live acceptance remains OPEN |
| 53 | MERGED | feat(repro): formalize fail-closed clean-host reconstruction dry-run | `be9fd2aa…` | `repro/clean-host-dryrun-20260927-v2` | Clean-host procedure landed; gate remains blocked |
| 54 | MERGED | test(secrets): formalize fail-closed cutover dry-run pack | `add4c4a…` | `hardening/secrets-cutover-dryrun-v2` | Synthetic fixtures; live cutover remains OPEN |
| 55 | MERGED | docs: inventory observed production contracts and service lifecycle | `e5b85ab…` | `docs/production-contract-inventory-v2` | Observed boundary inventory; no production mutation |
| 40 | CLOSED | feat(repro): fail-closed clean-host dry-run path | `7bdcbcd…` | `repro/clean-host-dryrun-20260927` | Superseded by #53 after main advanced |
| 45 | CLOSED | test(secrets): cutover dry-run doc fixtures | `67fe72d…` | `hardening/secrets-cutover-dryrun-doc-fixtures-20260927` | Superseded by #54 after main advanced |
| 52 | CLOSED | docs(lineage): Atom 4 evidence table — PR #39 MERGED | `407e571…` | `lineage/atom4-evidence-pr-table-honesty` | Superseded by this current evidence refresh |
| 22 | CLOSED | Inventory production contracts and service lifecycle | `74954dab…` | `docs/production-contract-inventory-20260927` | Superseded by #55 |

### Issues (search `lineage OR Helix OR overlay OR migration`)

| # | State | Title |
| --- | --- | --- |
| 26 | OPEN | Production finalization: backup retention and executor deployment gates |
| 13 | OPEN | production: increase RDS backup retention to 14 days |
| 28 | CLOSED | Production evidence: workspace unavailable from missing ws runtime dependency |
| 12 | CLOSED | production: provision least-privilege Secrets Manager agent token |

---

## 4. Clean pin / tag SHAs (observed)

### Accepted clean Helix pin (verified this run)

| Field | Value | How verified |
| --- | --- | --- |
| Commit | `38903b021cca75189a99e1ed88b508bae577f048` | GitHub API `get_commit` + `gh api` — **FOUND** |
| Message | `fix(worker): initialize task worker on gateway startup` | same |
| Author time | `2026-09-26T06:56:47Z` | same |
| Branch tip | `omnikali/production-db-bootstrap-20260926` → same SHA | `gh api …/commits?sha=…` |
| Helix `main` tip | `26c6879ed37df42c9c52178a5c55a429d65efdc1` | `gh api …/branches/main` |
| Merge-base (pin doc) | `a7cb8dc98b1cc668c1e481a845a48af004c4f510` | recorded in pin JSON / docs; **not re-computed** this run → treat as **documented**, not freshly re-listed |
| Ahead/behind (pin) | main **4 ahead / 28 behind** vs `38903b0` | documented in pin; **not re-run** `rev-list` this run |

### Tag `clean-reconstruction-38903b0` (verified this run)

| Field | Value |
| --- | --- |
| Tag name | `clean-reconstruction-38903b0` |
| Tag object | `6ef4db852a945d957b1e577327d6260bdd693197` (annotated) |
| Target commit | `38903b021cca75189a99e1ed88b508bae577f048` |
| Tagger date | `2026-09-27T06:45:08Z` |
| Source | `gh api` tag ref + annotated tag object; Atom 1 workspace note |

**Pin honesty (post-#42):** `reference/production/helix-lineage-pin.json` `tags_containing` on main now lists `clean-reconstruction-38903b0` (tag object `6ef4db852a945d957b1e577327d6260bdd693197` → commit `38903b021cca75189a99e1ed88b508bae577f048`; tagger `2026-09-27T06:45:08Z`). Merged as PR #42 @ `3ddd9c4bc31ce1a6a176c33c8ebfcb93a7bc8801` (Verify Gate ACCEPT post-land). This is pin honesty only — it does **not** unblock `executor_lineage` / clean_host / clean_release.

### Dirty / host-only SHAs (documented; not in Helix GitHub per pin)

| SHA | Role in docs | In Helix GitHub object store (per pin) |
| --- | --- | --- |
| `46ba4b71158a74db5ede97e300099370792ecff8` | Observed deployed checkout (dirty) | **no** (pin) |
| `357121db9496c6782c945499eaf3c90ea5ed9660` | Introduces exact deployed `agent-executor.mjs` (host) | **no** (pin) |
| Other host-only SHAs listed in pin `production_host_only_shas_not_in_helix_github` | Executor provenance chain | **no** (pin) |

This Atom 4 run did **not** re-clone Helix to re-`cat-file` those SHAs → leave presence claim as **documented in pin**, not freshly re-proven here.

---

## 5. Overlay / migration byte evidence (observed)

### LIVE pin digests (authority for G1 — from docs + Atom 2 ledger + PR #39 tree)

| Artifact | SHA-256 | Size | Runtime path (documented) |
| --- | --- | --- | --- |
| `omni-agent.mjs` | `ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d` | 4040 B | `/opt/helix/production/agent/omni-agent.mjs` |
| `agent-executor.mjs` | `6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e` | 910 B (PR #39 MANIFEST / pipe `wc -c`) | `/opt/helix/production/gateway/state/agent-executor.mjs` |

PR #39 blob check (`git show` \| `sha256sum`): both digests **match** LIVE table above.

### Grasshopper hardening delta on `main` (this run `sha256sum`)

| Path | SHA-256 | Size |
| --- | --- | --- |
| `reference/production/deployed/omni-agent.mjs` (= `src/production/omni-agent.mjs`) | `ffd3d5981cb8cc749cb112d312018b119c95e5613376f1695c59e226aed9b349` | 4223 B |
| `reference/production/deployed/agent-executor.mjs` (= `src/production/agent-executor.mjs`) | `d1ad94d942ebfd0898c79a18d649b5628bb7a31ce10cdbaf01cf57e4353758c2` | 1056 B |

Sidecar `reference/production/deployed/omni-agent.sha256` still asserts live `ee0a9898…` / 4040 B while checked-in `.mjs` is delta — **evidence inconsistency**, not unblock (matches gate docs).

### Helix acceptance tree gaps (API tree listing this run)

At `38903b0`, recursive tree paths matching agent-executor / omni-agent / guest-exec: **none**. Migrations present: `migrations/0001_auth.sql` … `0004_omnikali_tasks.sql` (plus `migrations/auth/0001_auth.sql`).

### Migration SHA-256 matrix (observed)

| File | Helix accepted (pin JSON) | Grasshopper `helix-accepted/migrations/` (this run) | Live (`observed-db-baseline.json`) |
| --- | --- | --- | --- |
| `0001_auth.sql` | `6f89964e…e78f` | `6f1746e0…11f9` (**differs**) | `f953cacc…63e9` (**differs**) |
| `0002_workspaces.sql` | `eb343cfe…f1a2` | `eb343cfe…f1a2` (match) | `eb343cfe…f1a2` (match) |
| `0003_stream.sql` | `90d2ef6d…5a03` | `90d2ef6d…5a03` (match) | `90d2ef6d…5a03` (match) |
| `0004_omnikali_tasks.sql` | `a20552b2…1ce9` | `6fb6375a…f75e` (**differs**; pin notes trailing newline) | `6fb6375a…f75e` (matches Grasshopper ref; differs Helix checkout) |

---

## 6. Gate snapshot (from pin + reconstruction manifest on tip)

| Gate | State |
| --- | --- |
| `clean_release_lineage` | blocked |
| `clean_host_reconstruction` | blocked |
| `production_mutation` | blocked |
| `executor_lineage` | blocked |
| `rollback_recovery_evidence` | blocked |
| `use_helix_main_alone_as_reconstruction_source` | blocked |
| `blind_overwrite_of_live_production_checkout` | forbidden |
| `iam_weakening` | forbidden |
| `production_mutation_allowed` | false |

---

## 7. UNKNOWN / not re-verified this run

- Fresh `git rev-list --left-right --count` merge-base ahead/behind (rely on pin).
- Fresh Helix full-clone `git cat-file` for every host-only SHA.
- Live host re-read of `/opt/helix/...` bytes (constraints forbid live Helix smoke / prod mutate).
- PR #39 merge status is now current: **MERGED** `505113c…`.
- Current Grasshopper main includes #44, #53, #54, and #55; superseded stale branches #40, #45, #52, and #22 are closed.
- Exact head OIDs marked UNKNOWN in §3 PR table.

---

## 8. Safety

No passwords, tokens, cookies, private keys, or secret payloads recorded. Neon is not treated as production. No AWS/RDS live change performed.
