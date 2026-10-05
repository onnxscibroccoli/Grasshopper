# OmniKali Rebuild Queue

**Snapshot:** 2026-10-05 EDT
**Authority:** `omn-kali-knowledge-graph-master/docs/ARCHITECTURE_SALVAGE_REGISTER_2026-10-05.md`

This queue exists so a future agent can continue without reconstructing the entire conversation.

## Operating mode

Preserve goals. Reject broken implementations. Do not fork another architecture.

Order:
1. protect validated Helix/Kali and Rish boundaries;
2. resolve persistent development storage;
3. rebuild Cloud Android viewer/input from the lowest proven transport upward;
4. finish Android observe/select/act/verify;
5. make BIST machine-readable;
6. refresh production acceptance;
7. make clean-host reconstruction deterministic;
8. verify Morphe source/build/runtime;
9. only then generalize to second executor/substrate and bounded autonomy.

## Immediate gates

### R1 Persistent development substrate
**Owner:** Grasshopper
**Status:** BLOCKED
**Evidence needed:** persistent writable build/cache area, root pressure reduced, no active runtime moved unsafely.

### R2 Cloud Android viewer/input
**Owner:** Grasshopper + kali-node/Helix boundary as appropriate
**Status:** BROKEN_NEEDS_REIMPLEMENTATION
**Goal:** persistent cloud Android with reconnectable viewer, physical keyboard/pointer input, Home/Back/Recents controls, and agentic ADB/MCP access.
**Required proof:** QEMU alive -> canonical VNC/RFB -> websockify -> viewer; then independent keyboard/pointer artifact; then reconnect without guest restart.
**Rule:** do not keep adding overlay controls to the failed viewer until the transport and input boundaries are independently proven.

### R3 Android executor
**Owner:** broccoli-core / broccoli-rish
**Status:** IN_PROGRESS / NOT_PROVEN
**Required proof:** physical device Rish/Shizuku marker + uid=2000 + SDK 35, then real-app observe/select/act/verify.
**Rule:** no second Rish wrapper and no RC=0-only pass.

### R4 BIST
**Owner:** Grasshopper
**Status:** OPEN
**Required proof:** strict JSON PASS/FAIL/NOT_PROVEN/NOT_APPLICABLE emitted and consumed by gates.

### R5 Production acceptance
**Owner:** Helix + Grasshopper
**Status:** OPEN
**Required proof:** fresh authenticated browser acceptance plus resilience matrix. Process health is insufficient.

### R6 Reproducibility
**Owner:** Grasshopper + Helix
**Status:** OPEN
**Required proof:** clean-host reconstruction from source/config/secret references with no undocumented operator steps.

### R7 Morphe source
**Owner:** Morphe repos + Grasshopper
**Status:** BLOCKED
**Required prerequisites:** persistent build storage + JDK.
**Required proof:** source build artifact hash, install confirmation, runtime verification.

## Branch/worktree warning

The current Grasshopper workstation checkout is on:
`feat/cloud-android-agentic-device-clean`

Its configured upstream branch is reported as gone. Before using it as a long-running automation base, reconcile it against the canonical remote/default branch and preserve any unpushed work. Do not delete or reset the branch blindly.

## Protected boundaries

- Do not bind prototype ingress to production 80/443.
- Do not replace CloudFront/nginx/Helix/QEMU with K3s/Traefik.
- Do not replace PostgreSQL with a convenience database.
- Do not modify canonical Rish because an RDC caller fails.
- Do not expose secrets, cookies, tokens, or credentials in evidence.
- Do not claim exactly-once side effects beyond executor guarantees.

## Continuation contract

Every gate produces:
- implementation;
- focused test;
- acceptance evidence;
- timestamp;
- source SHA/config identity;
- failure classification;
- rollback/recovery procedure where mutation occurs.

If a gate fails, classify the failing boundary first. If the existing implementation is broken, mark it `BROKEN_NEEDS_REIMPLEMENTATION` and preserve the goal/evidence before writing replacement code.

