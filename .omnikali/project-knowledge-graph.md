# OmniKali Cross-Repository Knowledge Graph

**GRAPH TAG:** OMNIKALI-KG-2026-09-28  
**Snapshot:** 2026-10-01 EDT

## Hierarchy
```
OMNIKALI
├── Public edge: omnikali
├── Control plane: helix
├── Reference/control contracts: Grasshopper
├── Persistent desktop: kali-node
├── Scalable desktop: grasshopper-kubernetes
├── Historical evidence and device philosophy: broccoli-core
├── Legacy edge: omnikali-link
└── Experimental/independent: kiln, lattice, publications, Shizuku projects
```

Broccoli detail lives in `docs/BROCCOLI_KNOWLEDGE_GRAPH.md` (`BROCCOLI-KG-2026-10-01`). Implementation rules taken from older Broccoli live in `docs/BROCCOLI_IMPLEMENTATION_PHILOSOPHY.md`.

## Rules for future agents
1. Read this graph before cross-repository changes.
2. Treat live acceptance evidence as stronger than README claims.
3. Never replace validated production architecture with an unverified redesign.
4. Distinguish pod/process health from user-visible desktop health.
5. Preserve restore points before risky changes.
6. Use real authentication and real end-to-end acceptance, not synthetic sessions.
7. Record proven facts, observations, hypotheses, planned work, failures, recovery, and timestamps.
8. Update this graph in every affected repository after material architecture changes.
9. Do not infer implementation from repository names. Empty repositories remain empty until code and tests prove otherwise.
10. Resolve duplicate ownership before creating another implementation.
11. Adopt older Broccoli's loop (intent, one schema, dry-run, confirm, remember). Do not copy its leftover script pile.

## Current evidence
Helix task lifecycle, PostgreSQL persistence, worker lease recovery, replacement-worker recovery, real Kali execution, and fencing/idempotency behavior have previously been exercised. Re-verify after changes.

Broccoli Termux -> Rish with `RISH_PRESERVE_ENV=0` printed `uid=2000(shell)` and sdk 35 on 2026-10-01. The RDC shell-written artifact gate remains NOT_PROVEN.

**Canonical graph marker:** `OMNIKALI-KG-2026-09-28`
