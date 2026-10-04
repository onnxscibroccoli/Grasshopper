# Paperclip isolation and migration contract

Date: 2026-10-04

Status: PLANNED

## Why this exists

The Helix production host experienced CPU exhaustion while running the persistent Kali KVM desktop and Paperclip on the same small EC2 instance.

The incident demonstrated a control-plane boundary failure: an orchestration component was allowed to become a competing workstation workload.

Grasshopper must prevent that architecture from recurring.

## Control-plane rule

Grasshopper treats Paperclip as orchestration infrastructure, not as part of the validated workstation runtime.

The protected path remains:

CloudFront -> nginx -> Helix -> libvirt/QEMU -> helix-omnikali

Paperclip must sit outside that path.

The intended relationship is:

Grasshopper contracts/evidence
-> Paperclip orchestration
-> authenticated Helix task API
-> isolated worker
-> persistent workstation

Paperclip must never become a second workstation runtime or a second task state machine.

## Migration contract

The production Helix KVM host is a protected workload boundary.

Paperclip may not be installed, enabled, or run there after migration.

The destination worker must provide:

- explicit CPU budget;
- explicit memory budget;
- independent lifecycle;
- least-privilege credentials;
- authenticated communication with Helix;
- deterministic task outcomes;
- cancellation;
- idempotency;
- timeout/lease handling;
- observable health;
- evidence IDs for live acceptance.

## Required BIST gates

Before production cutover:

1. PAPERCLIP_HOST_ISOLATED
2. PAPERCLIP_RESOURCE_BUDGET_DECLARED
3. PAPERCLIP_HELIX_AUTHORIZED
4. PAPERCLIP_TASK_ID_STABLE
5. PAPERCLIP_IDEMPOTENCY_VERIFIED
6. PAPERCLIP_CANCELLATION_VERIFIED
7. PAPERCLIP_TIMEOUT_RECLAIM_VERIFIED
8. PAPERCLIP_NO_QEMU_CONTROL
9. PAPERCLIP_NO_DUPLICATE_LIFECYCLE
10. PAPERCLIP_LIVE_ACCEPTANCE_EVIDENCE

Each gate uses the established status vocabulary:

PASS
FAIL
NOT_PROVEN
NOT_APPLICABLE

No production claim is made from source inspection alone.

## Migration sequence

Phase 0: keep Paperclip stopped and disabled on the production KVM host.

Phase 1: inventory the Paperclip service, configuration, ports, data, credentials, dependencies, logs, and representative resource usage.

Phase 2: provision an isolated worker with explicit CPU and memory limits.

Phase 3: integrate through the authenticated Helix task boundary.

Phase 4: run fixture and shadow tests without production KVM mutation.

Phase 5: execute one authenticated production acceptance and capture an evidence ID.

Phase 6: remove the old Paperclip placement and add drift detection.

## Fail-closed behavior

Grasshopper must report Paperclip migration as NOT_PROVEN until the acceptance evidence exists.

If Paperclip is detected on the production KVM host, the control plane should flag the architecture as non-conforming rather than silently treating the service as healthy.

If resource limits are absent, the migration is not complete.

If Paperclip can control QEMU directly, the integration is not conforming.

## Evidence from 2026-10-04

Observed:

- production host CPU reached approximately 100 percent;
- SSM became unavailable during the saturation;
- QEMU was the dominant consumer immediately after recovery;
- Paperclip was also a major consumer;
- stopping and disabling Paperclip materially reduced host contention;
- public /health, /auth/login, and /novnc/vnc.html returned HTTP 200 after recovery.

This establishes the need for isolation. It does not establish a final Paperclip worker size.

## Ownership

Grasshopper owns the orchestration contract, BIST gates, reconstruction expectations, and evidence coordination.

Helix owns the production KVM runtime.

kali-node owns Paperclip integration keeper behavior.

The OmniKali knowledge graph records the cross-repository state.

This document is a narrative companion to machine-readable graph and BIST records. It does not replace them.
