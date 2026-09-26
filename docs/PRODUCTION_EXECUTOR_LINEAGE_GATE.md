# Production executor lineage gate

Status: **unresolved**.

## Observed artifacts

The accepted production-fix revision `38903b021cca75189a99e1ed88b508bae577f048` does not contain the production runtime artifacts:

- `production/gateway/state/agent-executor.mjs`
- `production/agent/omni-agent.mjs`

GitHub code search of the authoritative `onnxscibroccoli/helix` repository found no indexed source for either filename, nor for the observed `guest-exec` implementation.

The live host remains the authoritative evidence for what is actually deployed, but not for source lineage.

## Current consequence

Neither artifact may be promoted into the reproducible release merely because it exists on production.

Before promotion, an authorized workflow must establish one of:

1. a Git commit containing the exact artifact;
2. a release/build artifact whose contents hash exactly matches the deployed SHA-256;
3. documented production-local source with explicit ownership and a controlled import into the canonical source repository.

The same rule applies to the gateway launcher and systemd drop-in.

## Required evidence

For each production-only artifact:

- exact bytes or deterministic source;
- SHA-256;
- originating commit/release, if available;
- dependency list;
- runtime configuration references;
- service lifecycle dependency;
- security boundary;
- acceptance evidence;
- rollback strategy.

No secrets or credential values may be imported into source or evidence.

## Executor hardening implication

The observed `omni-agent` bridge currently provides command execution through QEMU guest-agent. It is not itself evidence of durable operation idempotency or cancellation fencing.

Therefore the existing Grasshopper executor hardening contract remains necessary. The control plane must not infer external exactly-once side effects from the presence of the production bridge.

## Gate

`executor_lineage = blocked` until exact source/build provenance is recovered.

Production mutation remains disabled.
