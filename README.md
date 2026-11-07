# Grasshopper

**Status:** Reference OmniKali implementation and production reconstruction control plane  
**Repository:** `onnxscibroccoli/Grasshopper`  
**Documentation snapshot:** 2026-11-07 (source/documentation review; live runtime not re-tested)

Grasshopper is the control-plane implementation and reconstruction project that follows the verified production acceptance gate.

> **Verification boundary (2026-11-07):** This README was reviewed against the current public source, CI configuration, and the OmniKali coordination graph. It does **not** report a new live-device, cloud, production, multi-process concurrency, or disaster-recovery acceptance run. Earlier live-evidence claims remain dated historical records and must be reverified before use as current production proof.

Its governing idea is simple:

> The deployed production system supplies observed behavior. Grasshopper turns that behavior into reproducible contracts, source lineage, tests, infrastructure definitions, and an agent-operable implementation.

This repository is not supposed to rediscover the architecture by guesswork.

## North star

An authorized agent should eventually be able to reproduce the platform from source with **no undocumented operator steps**.

The repository therefore emphasizes provenance, reproducibility, durable execution, recovery, security boundaries, and explicit acceptance evidence.

## Current implementation

The local reference control plane implements:

- agent registration;
- resource declaration;
- file-backed state snapshots (transactional multi-process safety not yet established);
- logical lock records (distributed fencing and race safety require additional tests);
- asynchronous task execution;
- task recovery/reconciliation;
- deterministic export/import;
- authenticated Grok control-plane client;
- MCP facade;
- executor boundaries.

Key source files:

- `src/model.mjs` — domain contracts.
- `src/store.mjs` — atomic state store.
- `src/executor.mjs` — execution interface.
- `src/control-plane.mjs` — lifecycle/control-plane logic.
- `src/clients/grok-control-plane-client.mjs` — authenticated client.
- `src/mcp/grok-control-plane-tools.mjs` — MCP interface.
- `bin/omnikali.mjs` — reproducible CLI.

## Concurrency and ownership baseline

The file-backed store currently exhibits reproducible multi-process lost updates, and the task lifecycle permits stale callbacks to finalize an orphaned task. These are **open defects**, not supported production guarantees. See [Control-plane concurrency baseline](docs/architecture/CONTROL_PLANE_CONCURRENCY_BASELINE.md) for negative-control tests, known safe behavior, and transaction/fencing acceptance criteria. These tests do not establish live production readiness.

An **experimental, opt-in** [SQLite WAL state store](docs/adr/ADR-0002-transactional-state.md) provides transaction and stale-revision regression tests without changing the default JSON store. The [generation-fencing control-plane increment](docs/adr/ADR-0001-agentic-execution-fencing.md) adds atomic operation reservation and current-lease checks for callbacks, with cross-process tests using SQLite. **Default JSON storage still cannot guarantee multi-process integrity, and external side-effect fencing remains unproven.** Node 22's built-in SQLite API is experimental.

## Production evidence and recovery

The repository contains an unusually large documentation/evidence surface because it is intended to prevent future agents from destroying validated infrastructure while “improving” it.

Important documentation includes:

- `IMPLEMENTATION_SEED.md`
- `docs/PRODUCTION_LIVE_EVIDENCE.md`
- `docs/PRODUCTION_CONTRACT_INVENTORY.md`
- `docs/PRODUCTION_EXECUTOR_PROVENANCE.md`
- `docs/PRODUCTION_SERVICE_LIFECYCLE_EVIDENCE.md`
- `docs/PRODUCTION_STATE_AND_MIGRATION.md`
- `docs/PRODUCTION_SECURITY_HARDENING.md`
- `docs/ARCHITECTURE_VERIFICATION_2026-09-29.md`
- `docs/incidents/`
- `reference/production/`
- `scripts/live-acceptance/`

The live-acceptance suite contains explicit scenarios for normal execution, worker termination, stale lease reclamation, replacement completion, gateway restart, network interruption, database failure, and duplicate fencing.

## Current development state

**Phase:** `DEV_SANDBOX` (last documented, not fresh runtime verification)  
**OpenClaw:** 2026.9.7 on the OCI development workstation (historical documented version; not rechecked)  
**GitHub automation:** repository-side verification plus bounded agentic development loop (source-level inspection)  
**Recovery:** prior documented local OpenClaw backup and disposable restore drill (historical evidence; not rerun)  

The development architecture intentionally favors rapid iteration and continuous access inside the isolated development boundary. The safety controls are verified backup/recovery, explicit evidence, and a hard production boundary. See [`docs/SECURITY_PHASE_MODEL.md`](docs/SECURITY_PHASE_MODEL.md) and [`docs/AGENTIC_GITHUB_AUTOMATION.md`](docs/AGENTIC_GITHUB_AUTOMATION.md).

Known unproven items remain explicit: actual reboot survival, authenticated Android/operator access, production device scopes, off-host backup recovery, and complete authenticated desktop acceptance.

## Development cycle

**REFERENCE CONTROL PLANE WORKING / PRODUCTION RECONSTRUCTION STILL BEING FORMALIZED.**

The repository has crossed the clean-archive/reference-control-plane gates, while clean-host production reproduction remains a separate gate.

That distinction must remain explicit.

## Reproduce locally

The documented baseline is:

```bash
./scripts/bootstrap.sh
npm test
node bin/omnikali.mjs status
```

Agentic reproducibility can then be exercised with the repository's dedicated verification commands.

Production acceptance requires the appropriate credentials and authorized infrastructure and must not be simulated by local fixture tests.

## Pull-request security boundary

Pull-request verification is read-only and does **not** authorize merging, deployment, or acceptance. The prior automatic merge command has been removed from `.github/workflows/production-merge-gate.yml`; the existing workflow name remains stable for required-check compatibility. Maintainer-controlled promotion remains a separate decision. See [PR verification and promotion authority](docs/architecture/PR_VERIFICATION_AND_PROMOTION.md) for threat model, regression test, limitations, and recovery policy.

## AI model instructions

Grasshopper is the repository where an AI should be **most conservative about architecture changes**.

Before a large change:

1. read `IMPLEMENTATION_SEED.md`;
2. read `BASE_SYSTEM_PROTECTION.md`;
3. inspect the relevant production evidence;
4. establish the restore point;
5. make the smallest atomic change;
6. run the narrow tests;
7. run acceptance tests;
8. document the resulting evidence.

Never substitute a new architecture because it appears cleaner if the existing production contract has already been validated.

The model should treat provenance files and production reference snapshots as evidence, not as permission to expose secrets.

**Bottom line:** Grasshopper is the formal bridge between validated production behavior and an agent-reproducible OmniKali control plane.


## Cross-Repository Knowledge Graph

**GRAPH TAG: `OMNIKALI-KG-2026-09-28`**

Future AI agents MUST read [`.omnikali/project-knowledge-graph.md`](.omnikali/project-knowledge-graph.md) before cross-repository architectural changes. Verify capability with tests and live evidence, preserve restore points, make atomic changes, and update the graph after material architecture or failure knowledge changes.
