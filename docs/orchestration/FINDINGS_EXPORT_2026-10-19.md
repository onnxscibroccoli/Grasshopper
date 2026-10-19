# Findings export — bots, dead workers, past issues

**Date:** 2026-10-19 (America/New_York)  
**Source:** Grasshopper Bot master chat + live `gh` lists. Sibling private chats are incomplete here.

## Past orchestration issues (patterns)

1. **Opt HOLD vs Head override** — Opt Dispatcher refused mass-spawn without Ian confirm in Opt’s own chat; Head rewrote spawn-lead profiles; leads flip-flopped ACTIVE/PAUSED. Resolution: Ian must confirm in Opt chat OR accept Head BUDGET HOLD as authoritative freeze.
2. **Duplicate / conflicting fixture PRs** — #47 vs #48 same policy test path; #47 merged first then #48 conflicted; force-push `ac2a8e1` required Ian auth. Prefer canonical path merges before companion packs.
3. **Stale Gate digests** — Verify Gate briefly reported #47 unmerged after Head had merged `7d212c1`. Always re-check `gh pr view` before merge.
4. **COMPLETE inflation** — Departments feed “COMPLETE” for docs-only atoms; Gate correctly labels narrow ACCEPT and keeps live gates OPEN.
5. **Usage burn** — Wave256 ~203 workers + channel organizers produced high chatter. BUDGET HOLD (2026-09-27): stop CreateAgent; digests only.
6. **Fork bomb / usage override requests** — Rejected. Cannot reset usage; will not execute `:(){ :|:& };:`.

## Dead / idle worker policy

- Spawn Leads A–L: IDLE under BUDGET HOLD unless Ian lifts.
- Wave256 children created mid-batch (partial L19–L33, E7–E25, D1–D10, T1–T8, etc.): leave in place; do not delete via bot tools; Ian deletes from sidebar if needed.
- Channel organizers (Backup/Lineage/Build/Swarm): no new CreateChannel.
- Swarm Health: merge-blocker digests only.

## GitHub export command (re-run anytime)

```bash
gh pr list --repo onnxscibroccoli/Grasshopper --state open --limit 50
gh issue list --repo onnxscibroccoli/Grasshopper --state open --limit 50
gh pr list --repo onnxscibroccoli/broccoli-core --state open --limit 30
gh pr list --repo onnxscibroccoli/broccoli-rish --state open --limit 10
```

## Related open issues to reference

See handoff § Open board. High-signal: #145 salvage, #143 Cloud Android, #165 ARM64 lead boundary, #187/#188 gateway/OCI, #194 CI continuity.

