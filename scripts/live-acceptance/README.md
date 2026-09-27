# Live-acceptance scenario runner (shared scaffold)

Shared fail-closed framework that parallel `Scenario*` bots plug into. This directory
holds the runner CLI and per-scenario modules. It does **not** by itself prove live
acceptance: stubs stay OPEN, and `npm run verify:live-acceptance` still reads the
evidence manifest only.

## Path layout

```text
scripts/live-acceptance/
  README.md                 # this file
  scenario-ids.mjs          # REQUIRED_SCENARIO_IDS (8 ids)
  run-scenario.mjs          # CLI entry
  scenarios/
    _template/scenario.mjs  # copy-me template
    <id>/scenario.mjs       # one module per required scenario id
```

Evidence still lives at:

```text
reference/production/live-acceptance/manifest.json
```

Docs: `docs/LIVE_ACCEPTANCE.md`.

## Required scenario ids

Same eight ids as `scripts/verify-live-acceptance.mjs`:

- `normal_exec`
- `worker_termination`
- `stale_lease_reclaim`
- `replacement_completion`
- `duplicate_fencing`
- `gateway_restart`
- `db_failure`
- `network_interrupt`

Unknown ids are refused (exit 1).

## CLI

```bash
npm run live-acceptance:run -- --scenario <id> [--mode dry-run|record] [--json]
# or
node scripts/live-acceptance/run-scenario.mjs --scenario <id> [--mode dry-run|record] [--json]
```

### `dry-run` (default)

1. Resolve `--scenario` against `REQUIRED_SCENARIO_IDS` (unknown → exit 1).
2. Load `scenarios/<id>/scenario.mjs` if present (missing → exit 1).
3. Call `dryRun()` and print the result.
4. Exit 1 if `ok` is false / not_ok.
5. **Never** writes `COMPLETE` to the manifest.

### `record`

Fail-closed. Refuses unless **all** of the following are present:

- `--evidence <non-secret summary>`
- `--run-at <ISO date or datetime>`
- `--operator <non-secret label>`

and the scenario module's `liveRun(ctx)` (or equivalent record path) returns `{ ok: true, ... }`.

Otherwise exit 1 and leave the manifest unchanged. Do not invent dates. Do not mark
COMPLETE from a stub. Do not call Helix or mutate production from this scaffold.

Example (only after a real authorized run implements `liveRun`):

```bash
node scripts/live-acceptance/run-scenario.mjs \
  --scenario normal_exec \
  --mode record \
  --evidence "authorized isolated restore run YYYY-MM-DD; outcome summary" \
  --run-at 2026-09-27T18:00:00Z \
  --operator acceptance-dept
```

## Scenario module contract

Each `scenarios/<id>/scenario.mjs` exports:

| Export | Required | Shape |
|--------|----------|-------|
| `id` | yes | string matching directory name / required id |
| `label` | yes | human-readable string |
| `dryRun()` | yes | `{ ok: boolean, evidence: string }` — never claims COMPLETE |
| `liveRun(ctx)` | optional | async/sync `{ ok: boolean, evidence: string }` |

`dryRun()` is for local wiring checks. Returning `{ ok: false, evidence: "…" }` is
correct for unimplemented stubs. Scaffold stubs intentionally return not_ok so
scenarios remain OPEN.

## Fail-closed rules

- Unknown scenario id → exit 1.
- Missing scenario module → exit 1.
- `dryRun` not_ok → exit 1; no manifest write.
- `record` without `--evidence` / `--run-at` / `--operator` → exit 1; no manifest write.
- `record` when `liveRun` missing or returns not_ok → exit 1; no manifest write.
- Never store secrets, tokens, connection strings, or production hostnames in evidence.
- Stubs are **not** evidence. `verify-live-acceptance.mjs` behavior is unchanged.

## Relation to the evidence harness

| Command | Role |
|---------|------|
| `npm run live-acceptance:run` | Shared scenario runner scaffold (this directory) |
| `npm run verify:live-acceptance` | Reads manifest; exit 1 while any scenario is OPEN |

Passing a dry-run does not flip the manifest. Only an authorized, dated `record`
path (with all required flags and an implementing `liveRun`) may update COMPLETE.
