# OmniKali Cross-Repository Knowledge Graph

**Current graph:** OMNIKALI-SYSTEM-KG-2026-10-01
**Current goals:** OMNIKALI-SYSTEM-GOALS-2026-10-01
**Historical marker:** OMNIKALI-KG-2026-09-28
**Snapshot:** 2026-10-01 EDT

The current coordination graph and dependency-ordered goals live in the master repository:
onnxscibroccoli/omn-kali-knowledge-graph-master

Future agents should read the current system graph before cross-repository architectural changes. The older 2026-09-28 graph remains historical evidence.

## Rules

1. Read the current system graph before cross-repository changes.
2. Treat live acceptance evidence as stronger than README claims.
3. Never replace validated production architecture with an unverified redesign.
4. Distinguish process health from user-visible desktop health.
5. Preserve restore points before risky changes.
6. Use real authentication and real end-to-end acceptance.
7. Record proven facts, observations, hypotheses, planned work, failures, recovery, and timestamps.
8. Resolve duplicate ownership before creating another implementation.
9. Adopt the useful Broccoli loop without copying its historical script pile.
10. When evidence is missing, record NOT_PROVEN.

## Current evidence

Helix task lifecycle, PostgreSQL persistence, worker lease recovery, replacement-worker recovery, real Kali execution, and fencing/idempotency behavior have previously been exercised and require re-verification after changes.

Broccoli Termux -> Rish with RISH_PRESERVE_ENV=0 printed uid=2000(shell) and SDK 35 on 2026-10-01. Android-native MCP supervisor recovery has also been live-tested.

## Canonical execution rule

inspect -> establish provenance -> choose owner -> smallest change -> narrow test -> acceptance -> evidence -> graph update

## Persistent architectural goals — unified accessibility runtime (2026-10-13)

**Goal owners:** Broccoli Core owns normalized semantic UI graph, governor/event bus and action/control schema; Grasshopper owns device/provider orchestration and acceptance evidence; the Android companion owns secure user-mediated biometric/OAuth approval; Linux and Android adapters own their transport implementations. This is the north star even when only a subset is presently feasible.

**Required endpoints:** physical Android, persistent cloud Android and remotely windowed Linux/Kali desktop; dynamic voice/chat/code-development workflows can move among them. Common API/model/MCP capability registry, provider-neutral intent schema, signed action grants, idempotent execution, human-in-loop gates, and privacy-preserving observations; free and self-hosted first.

**Evidence and progress:** See `docs/architecture/UNIFIED_ACCESSIBLE_DEVICE_RUNTIME.md`, `docs/operations/OCI_ANDROID_QEMU_TRIAGE_2026-10-13.md` and `docs/operations/OCI_QEMU_RECLAMATION_RESULTS_2026-10-13.md`. Old QEMU experiment copies were removed only after private source archival and local desktop/Android transport checks. The active Android QEMU remains protected. Redroid is BLOCKED pending UEK Binder module support and secure resource admission.

**Non-negotiable source and privacy rule:** Read GitHub project source only from `main`, never via raw commit SHA or unmerged branches. No personal identifiers, private health/contact information, payment information, credentials or authenticated Android data in commits, documentation, issue bodies or AI context handoffs. All new work enters reviewable feature branches; protected main merges require operator approval.

**Invariant:** observing an event must not replay the command that caused it. Report executable acceptance evidence rather than process-only green status.
