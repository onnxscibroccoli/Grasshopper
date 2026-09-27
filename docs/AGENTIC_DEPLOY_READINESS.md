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
  - secret-manager-backed credential injection
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
- PR #22 (inventory) or PR #23 (backup TLS) were merged;
- the Grok control-plane client from PR #27 is on `main`.

Do not fabricate restore-point counts. Current verified independent database-level restore evidence is **one** recovery point; **fourteen** are required before the backup-retention gate can close.

## Production topology

Verified target (unchanged):

```text
authenticated client -> Helix gateway -> PostgreSQL -> worker -> Kali
```

Neon is not production. Do not introduce Neon as the production persistence layer.

## Adjacent work (do not merge from this gate)

| PR | Topic | Notes |
|----|-------|-------|
| #22 | production contract inventory | draft; note only |
| #23 | backup runner TLS | draft; note only |
| #27 | Grok control-plane client | open/ready separately; tip `1bfd67e`; not modified by this gate |

Until Grok client files exist on the branch under check, the Grok artifact remains `OPEN`. That is expected on `main` before #27 merges.

## How agents should use the report

1. Run `npm run verify:agentic-deploy-readiness` (or `node scripts/verify-agentic-deploy-readiness.mjs --json`).
2. Treat any critical `OPEN` gate as a hard blocker.
3. Close gates only with dated evidence in docs/manifests that an authorized operator can reproduce.
4. Never claim live deploy success from this static report alone.

## Safety

No passwords, credential values, session cookies, bearer tokens, private keys, or production connection strings belong in gate output, fixtures, or commits.
