# Helix release lineage pin

Status: **pinned; reconstruction remain fail-closed**.

This document encodes only facts verified on **2026-09-27** from GitHub API and a local clone of `onnxscibroccoli/helix`. It does not authorize production mutation, IAM changes, or blind overwrite of the live checkout.

Machine-readable companion: `reference/production/helix-lineage-pin.json`.  
Validator: `npm run validate:helix-lineage-pin`.

## Clean Helix (accepted release reference)

| Field | Verified value |
| --- | --- |
| Repository | `onnxscibroccoli/helix` (separate from Grasshopper; not a submodule) |
| Accepted production-fix SHA | `38903b021cca75189a99e1ed88b508bae577f048` |
| Message | `fix(worker): initialize task worker on gateway startup` |
| Author time | `2026-09-26T06:56:47Z` |
| Commit URL | https://github.com/onnxscibroccoli/helix/commit/38903b021cca75189a99e1ed88b508bae577f048 |
| Branch tip at verification | `omnikali/production-db-bootstrap-20260926` → exact SHA above |
| Also reachable from | `hardening/postgres-executor-cancellation` |
| Tags containing SHA | `clean-reconstruction-38903b0` (tag object `6ef4db852a945d957b1e577327d6260bdd693197` → `38903b021cca75189a99e1ed88b508bae577f048`; https://github.com/onnxscibroccoli/helix/releases/tag/clean-reconstruction-38903b0) |
| Diff of that commit | only `production/gateway/helix-gateway.mjs` (+1/−1) |

`agent-executor.mjs` and `omni-agent.mjs` are **absent** from the accepted tree (`git ls-tree` over the commit).

## Helix `main` is not the clean reconstruction source

At verification, Helix `main` was `d632064004eee30297d084d4cce876398a0b7112`.

| Check | Result |
| --- | --- |
| `main` descendant of `38903b0`? | **no** |
| `38903b0` descendant of `main`? | **no** |
| merge-base | `a7cb8dc98b1cc668c1e481a845a48af004c4f510` |
| `git rev-list --left-right --count origin/main...38903b0` | **4 ahead / 28 behind** |

Earlier Grasshopper docs listed `a7cb8dc…` as “current Helix main”; that SHA is the **merge-base**, not tip of `main` at this verification. Tip is `d632064…`. The “28 commits behind” count remains correct.

## Dirty production checkout (runtime evidence)

| Field | Stated / verified |
| --- | --- |
| Observed deployed checkout | `46ba4b71158a74db5ede97e300099370792ecff8` |
| Clean? | **no** (per reconstruction manifest / lineage docs) |
| Present in Helix GitHub object store? | **no** (`git cat-file` after full clone failed) |

Other production-host Git SHAs recorded in `docs/PRODUCTION_SOURCE_LINEAGE_RECONCILIATION.md` (executor provenance chain) were also **not** present in the Helix GitHub object store at verification. They remain host-local evidence, not clean release lineage.

## Migration evidence relationship

SHA-256 of migrations at Helix checkout `38903b0`:

| File | Helix accepted checkout SHA-256 |
| --- | --- |
| `0001_auth.sql` | `6f89964eddbf9c9e1d63ec69679f9962ee2278a7fe7ba17919f5aa5a33f6e78f` |
| `0002_workspaces.sql` | `eb343cfe1df2a8e66a619b2210d65f0e18963533180054ad72b261b98c12f1a2` |
| `0003_stream.sql` | `90d2ef6df1283449ba52cbc327e76d7d834abb13afb7f3a2473ad15726755a03` |
| `0004_omnikali_tasks.sql` | `a20552b27b92008307a2ce0bb09cf1ba26ab99fb1b2519f4507df23706cd1ce9` |

Grasshopper `reference/production/helix-accepted/migrations/` is an **evidence copy**, not authoritative Helix source:

- `0002` / `0003`: byte-identical to Helix checkout.
- `0001`: Grasshopper recovery banner replaced the Helix Better Auth header comment; DDL body matches.
- `0004`: trailing newline only (Helix lacks final newline).

Live migration SHA-256 values in `observed-db-baseline.json` still differ for some files; source/runtime drift remains a gate.

Full three-way reconciliation (Helix checkout vs Grasshopper evidence vs live hashes), including the live `0001` **UNKNOWN** content-diff note, is recorded in Atom 3: `docs/LINEAGE_ATOM3_MIGRATION_BYTE_RECONCILIATION_20260927.md` and `reference/production/migration-byte-reconciliation.json`. Do not treat Grasshopper evidence copies as authoritative Helix source.

## Existing gates (unchanged; still blocked)

From `reference/production/reconstruction-manifest.json` and executor/recovery docs:

1. `clean_release_lineage` — blocked  
2. `clean_host_reconstruction` — blocked  
3. `production_mutation` — blocked  
4. `executor_lineage` — blocked (`docs/PRODUCTION_EXECUTOR_LINEAGE_GATE.md`)  
5. `rollback_recovery_evidence` — blocked  
6. Credential rotation / secret-manager injection for the bridge — still required; no mutation performed here  

## Deterministic reconstruction next gates (safe order)

Do **not** overwrite live production or weaken IAM.

1. Treat `38903b0` (branch tip `omnikali/production-db-bootstrap-20260926`) as the clean Helix pin; do **not** use Helix `main` alone.  
2. Import or release-tag production-only artifacts (`agent-executor.mjs`, `omni-agent.mjs`, launcher/systemd overlays) with exact SHA-256 provenance into canonical Helix (or an explicit owned import path).  
3. Reconcile migration bytes: Helix checkout vs Grasshopper evidence vs live ledger hashes.  
4. Build a clean target from the pinned tree + imported overlays; run readiness + full acceptance.  
5. Establish rollback/recovery evidence; then rotate bridge credential into secret-manager injection.

Until those pass, keep `production_mutation_allowed: false`.

## Safety

No passwords, tokens, cookies, private keys, or secret payloads are recorded here.
