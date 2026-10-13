# Grasshopper

**Status:** Reference OmniKali implementation and production reconstruction control plane  
**Repository:** `onnxscibroccoli/Grasshopper`  
**Documentation snapshot:** 2026-10-01 00:30 UTC

Grasshopper is the control-plane implementation and reconstruction project that follows the verified production acceptance gate.

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
- durable state;
- exclusive locks;
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

**Phase:** `DEV_SANDBOX`  
**OpenClaw:** 2026.9.7 on the persistent OCI development workstation  
**GitHub automation:** repository-side verification plus bounded agentic development loop  
**Recovery:** verified local OpenClaw backup and disposable restore drill  

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


## Unified accessible device runtime and OCI Android status (2026-10-13)

Long-term source-of-truth goals: [Unified Accessible Device Runtime](docs/architecture/UNIFIED_ACCESSIBLE_DEVICE_RUNTIME.md). This defines provider- and device-neutral semantic application schemas, action/control contracts, human-authentication gates, model/MCP interchangeability, Android/cloud/Linux window streaming, voice/chat interaction and non-root accessibility-first operation.

OCI Android migration status: [QEMU evidence and retirement criteria](docs/operations/OCI_ANDROID_QEMU_TRIAGE_2026-10-13.md), [measured cleanup results](docs/operations/OCI_QEMU_RECLAMATION_RESULTS_2026-10-13.md) and the [Redroid handoff](docs/chatgpt-handoff-redroid-oci.md). The live QEMU Android is still running and partially responds to ADB; Redroid deployment **remains blocked** on Oracle UEK Binder support, rootful container admission, persistent image-store placement and memory safeguards. No production replacement is claimed.

**Source/privacy policy for development agents:** read source exclusively from `main` (never raw commit-SHA refs or unmerged branches); use an isolated feature branch for proposed writes; do not commit personal names, direct-contact details, medical details, session data or credentials. Human approval is required for merges. Older public history may require separately authorized exposure remediation.
