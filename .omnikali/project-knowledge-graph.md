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

## Human authentication gate workstream — 2026-10-03

**State:** PROPOSED / NOT_PROVEN until branch CI and end-to-end acceptance pass.

Ownership:
- Grasshopper: durable gate state, pause/resume semantics, checkpoint and credential references.
- Helix: authenticated phone/browser handoff to the original remote session.
- broccoli-core: Android-native UI detection/re-observation through the canonical Rish/accessibility transport.
- Outside Agent: private sanitized notification/control surface only; never a credential or challenge-answer store.

Invariant: human-only boundaries remain `HUMAN_REQUIRED`. A chat acknowledgement may request verification but cannot itself clear a gate. Resume requires fresh verification of the original browser/app session. Raw passwords, OTPs, CAPTCHA answers, cookies, bearer tokens, and provider access/refresh tokens must not enter the event stream, logs, prompts, Git, or Drive.

Reference contract: `docs/AUTH_GATE_HANDOFF.md`.
