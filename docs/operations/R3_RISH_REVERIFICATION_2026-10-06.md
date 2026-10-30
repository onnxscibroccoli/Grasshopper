# R3 Rish Reverification 2026-10-06

## Live result

The RDC -> Termux -> existing `lib/rish_run.sh` transport was reverified on the physical Android device after the local RDC service recovery.

Canonical probe:

`/data/data/com.termux/files/usr/bin/bash -lc 'bash $HOME/broccoli-core/tools/rdc_termux_anchor.sh'`

Observed result:

- Exit path returned `PASS`.
- Persistent artifact: `/storage/emulated/0/Download/RDC_TERMUX_ANCHOR.txt`.
- Artifact marker: `RDC_TERMUX_ANCHOR_OK`.
- Artifact shell identity: `uid=2000(shell)`.
- Artifact SDK: `35`.
- The anchor script invokes the existing `lib/rish_run.sh` with `RISH_PRESERVE_ENV=0` and treats the target-side artifact, not stdout or exit code alone, as the acceptance proof.
- The existing Rish wrapper was not modified by this verification.

## Acceptance interpretation

R3 is **PASS for the RDC -> Termux -> Rish transport gate**.

This resolves the previous `NOT_PROVEN` boundary. It does not by itself prove Ruto, secondary-display automation, browser automation, or higher-level MCP orchestration. Those remain separate capability gates.
