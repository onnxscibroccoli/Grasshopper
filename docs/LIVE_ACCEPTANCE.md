# Live acceptance evidence harness

## Purpose

This document describes the **fail-closed live readiness/acceptance evidence harness**:

```bash
npm run verify:live-acceptance
# or
node scripts/verify-live-acceptance.mjs --json
```

The harness makes the eight required live scenarios machine-checkable from **dated evidence artifacts**. It is **not** a live reproduction runner against Helix production. It refuses to report `ready=true` until every scenario has non-empty, dated COMPLETE evidence.

**A static gate is not live reproduction.** Passing `npm run verify:agentic-deploy-readiness` does **not** mean live acceptance ran. The static gate's `live_acceptance_automation` gate stays OPEN until this harness would report `ready=true` (all eight scenarios COMPLETE with dated evidence).

## Production topology (reminder)

```text
authenticated client -> Helix gateway -> PostgreSQL -> worker -> Kali
```

Neon is not production. Do not introduce Neon as the production persistence layer.

## Required scenarios

| ID | Label |
|----|-------|
| `normal_exec` | Normal authenticated task execution through gateway to worker/Kali |
| `worker_termination` | Worker termination preserves durable task state for reclaim |
| `stale_lease_reclaim` | Expired lease returns task to PENDING and allows reclaim |
| `replacement_completion` | Owner-fenced replacement completion after reclaim |
| `duplicate_fencing` | Duplicate/stale owner identity is fenced from completing |
| `gateway_restart` | Gateway restart preserves accepted work and resumes safely |
| `db_failure` | Database failure/outage surfaces safely without false COMPLETE |
| `network_interrupt` | Network interrupt between gateway/worker/DB does not corrupt task state |

## Evidence location

Structured starter artifact:

- `reference/production/live-acceptance/manifest.json`

Schema (version 1):

- `schema_version` (number)
- `name` (`live-acceptance`)
- `generated_at` (optional ISO timestamp, or `null` for starter)
- `notes` (array of non-secret strings)
- `topology` (string)
- `scenarios` (map of scenario id → entry)

Each scenario entry:

- `status`: `OPEN` | `COMPLETE`
- `label`: human-readable description
- `critical`: `true` for all eight required scenarios
- `evidence`: non-secret string (OPEN starter: `no dated live run yet`)
- `run_at`: ISO date/datetime of the authorized run, or `null`
- `operator`: non-secret operator or automation identity label, or `null`

## How to record COMPLETE

1. Obtain authorization for a live production check **or** (preferred) an isolated restore / non-prod path that exercises the same topology. Never mutate production without Ian authorization.
2. Run the scenario (scenario runners against Helix land in later PRs; this PR only scaffolds evidence checking).
3. Update the matching entry in `reference/production/live-acceptance/manifest.json`:
   - set `status` to `COMPLETE`
   - set `run_at` to an ISO date (e.g. `2026-09-27T18:00:00Z`)
   - set `evidence` to a short non-secret summary that includes the date and outcome
   - set `operator` to a non-secret label (e.g. `acceptance-dept` or an automation job name)
4. Re-run `npm run verify:live-acceptance`. Exit `0` only when **all eight** scenarios are COMPLETE with dated evidence.
5. Optionally note the dated run in this document under a dated section (no secrets).

### COMPLETE rules (fail-closed)

- Missing manifest → all scenarios OPEN.
- Missing scenario entry → that scenario OPEN.
- `status` not `COMPLETE` → OPEN.
- `COMPLETE` without `run_at` ISO date **and** without a date embedded in `evidence` → OPEN (undated).
- Empty evidence or starter text `no dated live run yet` → OPEN.

### Safety

Do **not** commit:

- passwords, tokens, cookies, private keys
- production connection strings
- hostnames that look like production endpoints
- secret payload values

## Relation to `verify:agentic-deploy-readiness`

| Check | What it proves | Live deploy success? |
|-------|----------------|----------------------|
| `npm run verify:agentic-deploy-readiness` | Repository artifacts + static reconstruction gates | **No** |
| `npm run verify:live-acceptance` | Dated evidence filed for all 8 live scenarios | **Only** that evidence was recorded; still not an automatic production deploy claim |

The static gate's `live_acceptance_automation` critical gate reads the live-acceptance manifest (when present) and flips to COMPLETE **only** when every required scenario is COMPLETE with non-empty dated evidence. With the starter OPEN artifact, that gate remains OPEN.

## What this harness is not

- Not a production deploy.
- Not an automatic Helix scenario runner (those come in later PRs).
- Not permission to mutate production.
- Not a substitute for clean-host reconstruction, backup retention, or secrets cutover gates.

## Starter state (2026-09-27)

All eight scenarios are **OPEN** with evidence `no dated live run yet`. No live deploy success is claimed.
