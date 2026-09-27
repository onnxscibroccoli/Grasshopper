# Agentic deploy readiness

## Purpose

This document describes the **static, fail-closed** agentic deploy-readiness gate:

```bash
npm run verify:agentic-deploy-readiness
```

The gate makes deploy readiness machine-checkable from repository evidence. It is intended for authorized automation agents that must refuse to claim a production-ready deploy when critical reconstruction gates remain open.

## What this gate is

- A repository scan for known-complete reference artifacts (executor contract, durable executor, RDS infrastructure module, independent backup runner/policy, production reproducibility docs, and Grok control-plane client files when present).
- A fail-closed evaluation of critical reconstruction gates:
  - clean source/release lineage
  - repository Secrets Manager injection contract (loader, drop-ins, docs, tests)
  - live production secrets cutover re-verification (distinct from the repository contract)
  - live readiness/acceptance automation
  - independent backup retention (>= 14 distinct restorable points)
  - deterministic clean-host reconstruction
- A JSON + text report that lists each item as `COMPLETE` or `OPEN`.
- Exit code `1` while any **critical** gate is `OPEN`.
- Exit code `0` only when every critical gate is `COMPLETE`.

## What this gate is not

**A static gate is not live reproduction.**

Passing (or even improving) this gate does **not** mean:

- a clean host was rebuilt from Git;
- Helix gateway -> PostgreSQL -> worker -> Kali was redeployed;
- live acceptance ran against production or an isolated restore;
- fourteen independent restore points exist;
- RDS PITR is fourteen days (it remains **1 day** until an authorized AWS change succeeds);
- live production secrets cutover has been re-verified;
- the executor-lineage, clean-host, rollback/recovery, and acceptance gates are closed.

Do not fabricate restore-point counts. Current verified independent database-level restore evidence is **one** recovery point; **fourteen** are required before the backup-retention gate can close.

## Production topology

Verified target (unchanged):

```text
authenticated client -> Helix gateway -> PostgreSQL -> worker -> Kali
```

Neon is not production. Do not introduce Neon as the production persistence layer.

## Current implementation state

The following hardening/formalization work is already on `main`:

- production contract and read-only service lifecycle inventory (#55);
- fail-closed clean-host reconstruction dry-run (#53);
- fail-closed secrets cutover dry-run pack (#54);
- replacement-completion dry-run fixtures (#44);
- Grok control-plane client and MCP facade;
- reference durable executor idempotency/cancellation fencing, including the cancellation/result race guard (#57);
- current lineage evidence refresh (#56).

These are implementation artifacts and repository evidence. They do not close the corresponding live gates.


## How agents should use the report

1. Run `npm run verify:agentic-deploy-readiness` (or `node scripts/verify-agentic-deploy-readiness.mjs --json`).
2. Treat any critical `OPEN` gate as a hard blocker.
3. Close gates only with dated evidence in docs/manifests that an authorized operator can reproduce. For `production_secrets_cutover`, follow [operations/PRODUCTION_SECRETS_CUTOVER_REVERIFY.md](./operations/PRODUCTION_SECRETS_CUTOVER_REVERIFY.md); do not add gate-close language without live host evidence.
4. Never claim live deploy success from this static report alone.

## Live acceptance harness (related)

The critical gate `live_acceptance_automation` stays **OPEN** until dated evidence exists for all eight live scenarios under `reference/production/live-acceptance/`.

Suite check: `npm run verify:live-acceptance`

That harness validates **evidence artifacts** only. It does not run against production by itself and does not let this static gate claim live deploy success. See `docs/LIVE_ACCEPTANCE.md`.

## Safety

No passwords, credential values, session cookies, bearer tokens, private keys, or production connection strings belong in gate output, fixtures, or commits.
