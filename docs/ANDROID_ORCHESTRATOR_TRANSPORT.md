# Android orchestrator transport contract

## Current live state

RDC -> Termux -> broccoli-core -> Rish -> Shizuku -> Android shell is now proven on the current device.

The target is Android SDK 35 and the privileged identity is uid=2000(shell). A named artifact was created and read back from shared Download.

## Background environment rule

Interactive Termux and RDC background processes are not equivalent environments.

A direct Rish invocation from the reduced RDC environment can return exit code 0 without executing the target command. Broccoli therefore owns runtime-environment normalization and Grasshopper consumes the Broccoli transport contract.

Grasshopper must not call Rish directly.

## Runtime supervisor rule

Exactly one supervisor owns the runtime and exactly one runtime child is allowed.

The previous supervisor used `set -o pipefail` together with `ps | grep -q`. A healthy match could terminate `ps` with SIGPIPE, causing the health test to return false and spawning another runtime every interval.

The repaired implementation uses:

- atomic lock directory
- PID ownership
- captured `ps` output
- exact runtime command matching
- one child PID file
- wake-lock request without treating it as proof

This is a production invariant. Duplicate workers are a correctness failure, not merely a performance issue.

## Evidence rule

Exit code alone never promotes a transport.

Promotion requires target-side observable evidence and, for file-based gates, artifact retrieval.
