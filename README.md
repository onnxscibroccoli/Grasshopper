# Grasshopper

**Status:** Reference OmniKali implementation and production reconstruction control plane  
**Repository:** `onnxscibroccoli/Grasshopper`  
**Documentation snapshot:** 2026-10-07 20:30 UTC

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

## ARM64 Android control evidence

The [2026-10-08 bounded observations](docs/OCI_ARM64_CONTROL_2026-10-08.md) record serial-proven boot completion, Android 16 trade-in mode as the expected cause of closed normal-shell requests, a stalled admitted helper downstream of ADB, a Setup Wizard ANR, and compositor-visible pointer acknowledgement over RFB. Upstream provenance also establishes that the pinned UTM archive is a full `user` build, so the ARM64 launcher now fails closed unless it is explicitly admitted for interactive, setup-gated provisioning; this never claims automation-ready ADB. Browser reconnect, authenticated normal-shell control, semantic UI recovery and R2 remain **NOT_PROVEN**. Preserve the live original guest; see the [scoped integration map](docs/OCI_ARM64_CONTROL_INTEGRATION_MAP.json).

The future full `userdebug` automation image now has a separate [build profile and digest-bound provenance gate](scripts/cloud-android/README.md#full-userdebug-vm-provenance). This defines reproducible admission but does not claim that an artifact has been built or accepted.

Its [clean-builder resource plan](docs/ARM64_USERDEBUG_BUILD_PLAN.md) is fail-closed. The OCI Android workstation does not meet the build envelope while Android QEMU is active, so no LineageOS build is authorized there.

The plan now includes a tested read-only live collector and SHA-256-bound admission evidence format. The collector was not executed on OCI because that active Android node is not an isolated builder; this repository change does not promote it or authorize a build.

The [existing no-new-capacity candidate inventory](docs/ARM64_USERDEBUG_BUILDER_CANDIDATES.json) currently reports `NO_ELIGIBLE_NODE`. It is bound to a reusable [Draft 2020-12 schema](schemas/grasshopper-builder-candidate-inventory-v1.schema.json) and the deterministic `npm run verify:cloud-android-userdebug-candidates` repository command. Static observations can nominate a host for live collection but can never authorize the build directly.

Provider-neutral control acceptance now uses a separate [Android control evidence schema](schemas/grasshopper-android-control-evidence-v1.schema.json). `npm run verify:android-control-evidence` keeps input delivery, visible acknowledgement, semantic effect and reconnect continuity independent. Hashed artifacts are mandatory for PASS gates, and `TEST_FIXTURE` evidence can never claim live acceptance or R2.

The repository-only [RFB observation adapter](scripts/cloud-android/adapt-rfb-observation.mjs) converts already-captured workstation before/after frames into that format without dispatching or replaying input. It can prove only a changed visible frame; delivery, semantic effect, reconnect continuity and R2 remain `NOT_PROVEN` until separately evidenced.

The [browser reconnect adapter](scripts/cloud-android/adapt-browser-reconnect-observation.mjs) likewise consumes evidence rather than operating the browser. It accepts reconnect continuity only from a digest-bound record proving the same source/node/transport/session, advancing sequence, client-only disconnect and no guest restart. It leaves delivery, visual acknowledgement, semantic effect, overall live acceptance and R2 `NOT_PROVEN`.

The [physical-Android Rish adapter](scripts/cloud-android/adapt-physical-android-rish-observation.mjs) accepts only digest-bound observation records tied to `onnxscibroccoli/broccoli-core:lib/rish_run.sh`, exact commit/blob provenance and `RISH_PRESERVE_ENV=0`. It does not contain or execute Rish. Wrapper qualification alone cannot prove cloud-device input delivery or any other control gate.

The [control evidence bundle schema](schemas/grasshopper-android-control-evidence-bundle-v1.schema.json) indexes exact workstation, browser and physical-Android evidence bytes without merging their gates. `npm run verify:android-control-evidence-bundle` rejects missing or duplicate origins, source/session mixing, transport/node substitution, digest mismatch and `TEST_FIXTURE` relabeling. A valid index remains `NOT_PROVEN`; it cannot infer cross-origin equivalence, live acceptance or R2.

`npm run report:android-control-gaps` produces a deterministic per-origin gap report only after that bundle verifies. It retains the bundle digest and source/session/node/transport bindings, lists non-PASS gates separately for each origin, and contains no executable remediation. Complementary PASS gates from different origins cannot become an aggregate PASS.

`npm run verify:android-control-acquisition-requirements` validates a non-executable acquisition-requirements manifest against the exact gap report and original bundle. The manifest binds a freshly observed guest PID/start/fingerprint, expires within 20 minutes, and repeats each origin's exact missing gates and evidence identity. It never authorizes collection, live acceptance, or R2.

`npm run verify:android-control-acquisition-receipt` verifies independently supplied artifact bytes against that still-valid manifest. It revalidates the complete requirements/gap/bundle chain, keeps workstation, browser and physical-Android receipts separate, and reports only `ARTIFACT_BOUND`; it cannot dispatch collection, upgrade a control gate to PASS, claim live acceptance or close R2.

`npm run report:android-control-acquisition-coverage` compares a verified receipt with its manifest and reports bound versus still-uncollected gates for each origin. Even complete artifact coverage is explicitly not acceptance and remains `NOT_PROVEN`.
