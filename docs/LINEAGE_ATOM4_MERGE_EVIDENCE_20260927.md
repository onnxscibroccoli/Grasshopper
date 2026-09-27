# Atom 4 — Helix clean-source vs dirty-prod lineage evidence

**Inventory date:** 2026-09-27 (America/New_York / ET)  
**Agent:** Lineage Merge Strategy (Atom 4)  
**Grasshopper tip observed:** `cba6c4a7337c7db2ea77d22a4dfa9312aed4255a` (`origin/main` after pull)  
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
| `reference/production/overlays/live-pin/` | **ABSENT on `main`** at tip `cba6c4a…` |

### Workspace Lineage evidence (outside repo tree)

| Path | Observed |
| --- | --- |
| `/workspace/lineage-dept-evidence/atom1-helix-tag-20260927.md` | Tag creation evidence |
| `/workspace/lineage-dept-evidence/atom2-sha-ledger-20260927.md` | LOCKED LIVE vs delta digests |
| `/workspace/lineage-dept-evidence/live-overlay-bytes/` | Present (directory listed; bytes used by Atom 2 PR) |

### Open Atom 2 PR overlay paths (not on `main` yet)

Branch `lineage/atom2-overlays-live-pin-20260927` / PR #39:

- `docs/OVERLAYS_LIVE_PIN_IMPORT.md`
- `reference/production/overlays/live-pin/MANIFEST.json`
- `reference/production/overlays/live-pin/omni-agent.mjs`
- `reference/production/overlays/live-pin/agent-executor.mjs`

---

## 3. Related PRs / issues (observed via `gh` / GitHub search)

### Pull requests (lineage / Helix / overlays / migrations / gates)

| # | State | Title | Head SHA | Head branch | Notes |
| --- | --- | --- | --- | --- | --- |
| 39 | OPEN | docs(lineage): live-pin overlay import (Atom 2 evidence; gate stays blocked) | `0c29e8bba571415dd2e43e07e3ed88040070608d` | `lineage/atom2-overlays-live-pin-20260927` | Live-pin bytes; gate stays blocked |
| 38 | OPEN | test: pin durable executor cancel fencing paths | `cf86f64a2167bc2a6ab17c44f79ffff207f57ce9` | `hardening/executor-fencing-cancel-paths-20260927` | Tests; lineage untouched |
| 40 | OPEN | feat(repro): fail-closed clean-host dry-run path | `b79cd77f489cb7a5fd9e5c451aee33582fb84b9e` | `repro/clean-host-dryrun-20260927` | Adjacent repro |
| 37 | MERGED | test: require reconciliation metadata for read-only indeterminate completion | `08d3829a0bfe67e3e10ee330c57c93712a2c2dbd` | `hardening/executor-fencing-readonly-reconcile-20260927` | Merged 2026-09-27T06:53:10Z |
| 36 | MERGED | feat(acceptance): fail-closed live acceptance evidence harness scaffold | (merged via main history) | `acceptance/live-harness-scaffold` | Acceptance harness |
| 35 | MERGED | docs: executor lineage evidence gaps (G1/G6); keep gate blocked | `0794d755bf4b55f01146aa6089eaa9e33089b963` | `hardening/executor-lineage-evidence-gaps-20260927` | Merged 2026-09-27T06:49:55Z |
| 34 | MERGED | (Grok Helix gateway wiring — from main log) | UNKNOWN head OID this run | `controlplane/grok-helix-gateway-wiring` | Seen in `git log` merge |
| 33 | MERGED | docs: live secrets cutover re-verification checklist | UNKNOWN head this run | secrets cutover docs | Adjacent secrets |
| 32 | MERGED | fix: split secrets injection into repo contract vs live cutover | UNKNOWN head this run | secrets readiness | Adjacent |
| 31 | MERGED | docs(gate): pin verified Helix acceptance lineage fail-closed | `6e67538579dbd66685b3aaa9464b6a702e73073f` | `docs/helix-release-lineage-pin-20260927` | Merged 2026-09-27T06:41:35Z |
| 29 | MERGED | Add fail-closed agentic deploy readiness gate | `30bb660f5734ffdffa65799cf0ad0273e1d78413` | `hardening/agentic-deploy-readiness-gate-20260927` | Lineage critical OPEN |
| 25 | MERGED | docs: reconcile backup host state and reconstruction gates | `fb765463dcc703a9532ed7e0c547b8e3bf99bfe9` | `docs/reconstruction-backup-status-20260927` | Migrations `0001`–`0004` checks |
| 23 | MERGED | Fix PostgreSQL backup runner TLS invocation | `dea8413e48b99d6f96d101a3ac41d5bd44eded15` | `fix/backup-runner-tls` | Adjacent |
| 22 | OPEN (draft) | Inventory production contracts and service lifecycle | `74954dabfdaf8b2e9b692d03768b53445aa7b75c` | `docs/production-contract-inventory-20260927` | Draft inventory |
| 16 | MERGED | feat: move agent bridge credentials to Secrets Manager | UNKNOWN head this run | — | Migration / secrets |
| 7 | MERGED | Harden agent secret reconstruction boundary | UNKNOWN head this run | — | Reconstruction |

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
| Helix `main` tip | `d632064004eee30297d084d4cce876398a0b7112` | `gh api …/branches/main` |
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
- Whether PR #39 has been reviewed/merged after this inventory.
- Exact head OIDs marked UNKNOWN in §3 PR table.

---

## 8. Safety

No passwords, tokens, cookies, private keys, or secret payloads recorded. Neon is not treated as production. No AWS/RDS live change performed.
