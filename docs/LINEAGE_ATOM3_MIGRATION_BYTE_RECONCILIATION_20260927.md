# Atom 3 — Live vs Helix migration byte reconciliation

**Inventory date:** 2026-09-27 (America/New_York / ET)  
**Agent:** Lineage Migrations (Atom 3)  
**Status:** evidence only — **not COMPLETE**; `migration_byte_identity` remains **blocked**

Fail-closed rules applied: only observed hashes and file bytes available in-repo or fetched from Helix GitHub at the accepted pin; **UNKNOWN** where live file bytes are absent; no invented Git history; no secrets; no production mutation.

Machine-readable companion: `reference/production/migration-byte-reconciliation.json`  
Validator: `npm run validate:migration-byte-reconciliation`

## Scope

Three-way SHA-256 comparison for the numbered migration chain:

1. Helix accepted checkout `38903b021cca75189a99e1ed88b508bae577f048` (`onnxscibroccoli/helix`, paths `migrations/0001_auth.sql` … `0004_omnikali_tasks.sql`)
2. Grasshopper evidence copies at `reference/production/helix-accepted/migrations/`
3. Live recorded hashes in `reference/production/observed-db-baseline.json` (`migration_sha256`)

Live migration **file bytes are not checked into Grasshopper**. Live identity for this atom is hash-only from the observed baseline. Deployed checkout `46ba4b71158a74db5ede97e300099370792ecff8` remains dirty runtime evidence (not a clean release artifact).

## Verification method (this run)

- `gh api` Contents API for Helix files at ref `38903b0…`, then `sha256sum`
- `sha256sum` on Grasshopper reference migration files on `origin/main`
- Read live hashes exclusively from `observed-db-baseline.json` (no live host access; no invented bytes)
- For `0001`: comment-stripped DDL body equality check Helix vs Grasshopper reference only
- For `0004`: trailing-newline-normalized equality Helix vs Grasshopper reference

## SHA-256 matrix

| File | Helix `38903b0` | Grasshopper reference | Live (baseline) | Helix=GH | GH=Live | Helix=Live |
| --- | --- | --- | --- | --- | --- | --- |
| `0001_auth.sql` | `6f89964eddbf9c9e1d63ec69679f9962ee2278a7fe7ba17919f5aa5a33f6e78f` | `6f1746e0d5d48d1a2d306fec36c033f312f45759dc6f7af065c3718169bf11f9` | `f953cacc448c0c81ae4fe63e66b0e59569e840782ad279fdee201dff529363e9` | no | no | no |
| `0002_workspaces.sql` | `eb343cfe1df2a8e66a619b2210d65f0e18963533180054ad72b261b98c12f1a2` | same | same | yes | yes | yes |
| `0003_stream.sql` | `90d2ef6df1283449ba52cbc327e76d7d834abb13afb7f3a2473ad15726755a03` | same | same | yes | yes | yes |
| `0004_omnikali_tasks.sql` | `a20552b27b92008307a2ce0bb09cf1ba26ab99fb1b2519f4507df23706cd1ce9` | `6fb6375a598ce4cc31a6e19150b7bdd187b21a6289e167dc136ce28508d8f75e` | `6fb6375a598ce4cc31a6e19150b7bdd187b21a6289e167dc136ce28508d8f75e` | no | yes | no |

## Findings

### Identical across all three (hash)

- `0002_workspaces.sql`
- `0003_stream.sql`

### `0004_omnikali_tasks.sql`

Helix checkout lacks a final trailing newline; Grasshopper evidence copy and the live recorded hash include it. Bodies are identical after `rstrip('\n')`. This is documented whitespace drift, not DDL drift.

### `0001_auth.sql`

- **Helix vs Grasshopper reference:** full-file SHA-256 differs because the Grasshopper recovery banner replaced the Helix Better Auth header comment block. Comment-stripped DDL bodies are byte-identical (verified this run).
- **Live vs Helix / Grasshopper reference:** live SHA-256 differs from both. Live file bytes are **not** in this repository. Content-diff cause for live `0001` is therefore **UNKNOWN** (hash-only evidence). Do not treat Grasshopper reference or Helix header-only notes as proof of the live file contents.

## Gate status (unchanged / fail-closed)

| Gate | Status |
| --- | --- |
| `migration_byte_identity` | **blocked** |
| `clean_release_lineage` | blocked (unchanged) |
| `production_mutation` | blocked / forbidden blind overwrite |
| COMPLETE claim for Atom 3 | **not made** — Verify Gate required |

Reconstruction and merge strategy remain gated on resolving source/runtime migration drift (especially live `0001`) without inventing bytes or overwriting the live checkout.

## Related

- Pin: `docs/HELIX_RELEASE_LINEAGE_PIN.md`, `reference/production/helix-lineage-pin.json`
- Prior narrative: `docs/PRODUCTION_SOURCE_LINEAGE_RECONCILIATION.md` (Migration reconciliation)
- Live hashes: `reference/production/observed-db-baseline.json`
- Atom 2 live-pin overlays: PR #39 (merged)
- Atom 4 merge strategy: PR #41 (land order free relative to this PR)
- Tags pin: PR #42 (merged)

## Safety

No passwords, tokens, cookies, private keys, connection strings, or secret payloads are recorded here.
