# Portability and execution-boundary lessons

**Status:** active engineering constraint  
**Source incident:** Broccoli/Rish/RDC verification on 2026-10-01  
**Rule:** host-shell assumptions and target-shell assumptions are different contracts.

## Incident

The verified Rish transport worked from the Broccoli repository:

- RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ...
- target result: uid=2000(shell)
- Android SDK: 35
- marker command completed and printed WROTE

The same command failed when launched from `~` because `./lib/rish_run.sh` was relative to the caller's current directory. After entering Rish, a command that invoked `bash` failed because Android's target shell did not provide bash at that path.

Neither failure invalidated Rish. Both were boundary failures.

## Required design rules

1. **Caller paths are never implicit.** A reusable command must anchor repository paths from its own location or explicitly establish the repository root.
2. **Host and target shells are separate runtimes.**
   Contract marker: host and target shells are separate runtimes. Termux can invoke Bash; an Android Rish payload must use commands available in the target shell unless the payload explicitly selects an installed interpreter.
3. **Transport proof is not application proof.** uid=2000(shell) proves the Rish execution identity. It does not prove RDC, artifact retrieval, desktop control, or end-to-end product behavior.
4. **One failure gets one classification.** Record cwd, host interpreter, target interpreter, transport, exit code, stdout/stderr, and artifact state before changing a known-good executor.
5. **Do not repair a working transport for a caller mistake.** First reproduce from the documented working boundary. Then fix the caller or contract.
6. **Every reusable command must be copy/paste safe from an arbitrary working directory.** If that is not true, the command must say so explicitly and the repository must provide a root-independent entrypoint.
7. **Target commands should be POSIX-sh compatible by default.** Bash-specific syntax belongs on the Termux/host side unless the target explicitly proves Bash exists.
8. **Artifacts close gates.** A successful exit code without the named artifact is NOT_PROVEN.

## Agent test pattern

    host invocation from arbitrary cwd
        -> repository entrypoint resolves itself
        -> transport starts
        -> target shell executes POSIX command
        -> identity/version evidence appears
        -> named artifact is created
        -> artifact is fetched back
        -> only then does the gate become PASS

This is a design constraint, not a troubleshooting checklist to remember in chat.