# Degradation lessons from Broccoli

**Status:** active constraint  
**Source:** `onnxscibroccoli/broccoli-core` as it exists, not as its early docs hoped  
**Enforced by:** `scripts/verify-no-broccoli-degradation.mjs`

Older Broccoli was helpful because the loop lived in the repo: intent, one schema, dry-run, confirm, remember. It degraded when agents replaced that loop with claims, stubs, and duplicate scripts. Grasshopper does not get to repeat that.

## What actually degraded

1. **The contract left the repo.** `docs/ENGINEERING.md` became `# see chat ENGINEERING.md`. The next agent inherited a pointer, not a rule.
2. **Shipped was a label.** Milestone issues said M1–M10 shipped while files were `*_PLACEHOLDER`. That was not a ship. `docs/KERNEL.md` had to call that a lie.
3. **Incidents became files.** `advance_step*.sh`, root logs, pid files, `.bak` copies, and docx dumps accumulated. Nothing deleted the last attempt.
4. **The atom forked.** `rish_run.sh` exists at the root and under `lib/`. Event bus exists twice. Two implementations means neither is the source.
5. **RC=0 replaced evidence.** RDC `rish` and `am` returned 0 with no artifact. That was recorded as if it might be success. Empty stdout is NOT_PROVEN.
6. **The new caller edited the wrong boundary.** The known-good Rish path worked with `RISH_PRESERVE_ENV=0`. The failure was the caller environment and the proof path, not the wrapper.
7. **The loop inverted.** `INSTRUCTIONS.md` says the phone closes its own loop and Mac chat is optional. Later work required a human to paste chat back.
8. **Install ended by stopping the daemon.** The instruction says never finish with `AGENT_STOP`. Sessions did the opposite.

## Rules that follow

- A rule a test does not read is a chat message. Put it in a file the guard reads.
- NOT_PROVEN is a valid status. PASS requires the named artifact. For the Android gate that marker is `ARTIFACT_FETCHED=yes` plus the file.
- One implementation per atom. Do not copy `rish_run.sh` into Grasshopper.
- No root debris: logs, pid files, bak files, `advance_step*.sh`, docx dumps.
- A doc that only says "see chat" fails.
- A placeholder marked shipped fails.
- Do not modify a known-good executor to explain a new transport.
- Finish with the next gate named and the daemon still running.

## What this does not close

The RDC -> Termux artifact gate stays NOT_PROVEN until `/storage/emulated/0/Download/RDC_TERMUX_ANCHOR.txt` is fetched back with `RDC_TERMUX_ANCHOR_OK`, `uid=2000(shell)`, and `sdk=35`. This document does not promote that node.


## New boundary lesson: working transport, wrong caller

On 2026-10-01 the Rish transport was proven from `~/broccoli-core` with `RISH_PRESERVE_ENV=0`. The identical relative-path invocation from `~` failed because `./lib/rish_run.sh` was not addressable there. A subsequent Rish payload failed because Android's target shell had no `bash`. These are caller/target-runtime failures, not evidence that the known-good transport is broken. See `docs/PORTABILITY_AND_EXECUTION_BOUNDARIES.md`.
