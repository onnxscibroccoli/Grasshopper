# Clean-host reconstruction (fail-closed)

Status: **OPEN / blocked**. This document formalizes the deterministic clean-host procedure. It does **not** close `clean_host_reconstruction`.

Verify Gate (2026-09-27): ACCEPT scoped for procedure/dry-run drafts; **REJECT** COMPLETE until Lineage live-pin overlays, migration byte reconcile, and non-prod rehearsal evidence exist.

## Purpose

Reconstruct the verified topology on a **clean non-prod host** from Git + documented input **refs** (never secret values):

`authenticated client → Helix gateway → PostgreSQL → worker → Kali`

## Source pins

| Role | Ref | Notes |
| --- | --- | --- |
| Helix clean acceptance | tag `clean-reconstruction-38903b0` → `38903b021cca75189a99e1ed88b508bae577f048` | Prefer tag over Helix `main` alone |
| Dirty prod checkout | `46ba4b71158a74db5ede97e300099370792ecff8` | Runtime evidence only; **not** on Helix GitHub; not a clean release id |
| Grasshopper contracts | tip under operator control | Manifest + validators |

Do **not** overwrite a live production checkout. Do **not** weaken IAM.

## STOP conditions (fail-closed)

Stop before claiming COMPLETE when any of the following hold:

1. `reference/production/reconstruction-manifest.json` → `gates.clean_host_reconstruction` is `blocked`
2. Lineage live-pin overlay package under `reference/production/overlays/live-pin/` is missing or SHA-mismatched (`omni-agent` / `agent-executor` and related systemd/launcher blobs)
3. Migration bytes Helix vs evidence vs live ledger still diverge without a documented reconcile
4. Required deployment input refs are absent (see below)
5. Non-prod readiness + acceptance evidence package is absent

Static validator PASS ≠ live clean-host COMPLETE.

## Required input refs (values outside source)

From `scripts/validate-production-inputs.mjs` and deployment contracts:

- `OMNIKALI_AWS_REGION`
- `OMNIKALI_VPC_ID`
- `OMNIKALI_DATABASE_ENDPOINT`
- `OMNIKALI_DATABASE_NAME`
- `OMNIKALI_DATABASE_SECRET_ID`
- `OMNIKALI_AGENT_SECRET_ID`
- `OMNIKALI_GATEWAY_SERVICE`
- `OMNIKALI_WORKER_SERVICE`
- `OMNIKALI_READINESS_URL`
- `OMNIKALI_ACCEPTANCE_MODE`

Also seen in recovered runtime evidence (refs only): `HELIX_AGENT_TOKEN_SECRET_ID`, `HELIX_DB_SECRET_ARN`, secret name `omnikali/production/agent-bridge-token`.

Forbidden as deployment inputs: `AGENT_TOKEN` payloads, DB passwords, cookies, private keys.

## Ordered procedure

1. **Evidence freeze** — record operator, date, non-prod target; verify Helix tag object; record Grasshopper HEAD + manifest gates.
2. **Source materialization** — clean checkout Helix at the acceptance tag; materialize only documented overlays with SHA-256 provenance (Lineage-owned live-pin path).
3. **Infrastructure** — verify existing network/DB boundary refs; Terraform plan only against authorized IDs (no guessed topology; no Neon).
4. **IAM** — resource-scoped secret read (+ KMS decrypt when required); no list/create/rotate/IAM-admin for convenience.
5. **Database** — resolve DB secret via runtime identity; apply migrations `0001`→`0004` in order; fail without partially claiming unapplied migrations; never print credentials.
6. **Protected runtime config** — install ref-only env + fail-closed launchers.
7. **Service lifecycle** — DB usable → gateway (worker init on startup) → omni-agent bridge; preserve durable task/lease state.
8. **Readiness** — service active; gateway health; DB usable; worker initialized; authenticated task reaches control plane.
9. **Acceptance** — non-prod scenarios (normal, interrupt, stale lease, replacement, duplicate fencing, gateway restart, DB failure, network interrupt).
10. **Rollback/recovery evidence** — independent backup verify + restore; do not fabricate restore-point counts.
11. **Gate close** — only after Verify Gate ACCEPT of operator-rerunnable evidence.

## Machine dry-run

```bash
npm run verify:clean-host-dryrun
```

This wrapper runs the static fail-closed suite and **exits non-zero** while `clean_host_reconstruction` remains blocked (or readiness reports that gate OPEN). See `docs` Atom-3 definition and `scripts/verify-clean-host-dryrun.mjs`.

## Related

- `docs/REFERENCE_REPRODUCIBILITY.md` — local reference only
- `docs/PRODUCTION_REPRODUCIBILITY.md` — production contract
- `docs/HELIX_RELEASE_LINEAGE_PIN.md` — lineage pin
- `reference/production/reconstruction-manifest.json` — machine gates
