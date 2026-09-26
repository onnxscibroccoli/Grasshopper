# Production Executor Boundary

The accepted Helix task-control source and the deployed execution artifact are different layers.

## Accepted control-plane executor adapter

At the accepted production revision, the gateway references `production/gateway/state/agent-executor.mjs`, but that file is absent from the accepted repository tree.

The live host contains the missing adapter and its recovered SHA-256 is:

`6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e`

The adapter forwards only:

- command
- cwd
- timeout

to the authenticated local agent bridge.

## Deployed execution service

The actual execution service is `omni-agent.service`.

Its recovered artifact is preserved at `reference/production/deployed/omni-agent.mjs`.

It:

1. authenticates the local HTTP request with the runtime bearer token;
2. validates command, cwd, and timeout bounds;
3. calls libvirt `qemu-agent-command`;
4. invokes QEMU guest-agent `guest-exec` in VM `helix-omnikali`;
5. polls `guest-exec-status`;
6. returns exit code, signal, stdout, and stderr.

Recovered SHA-256:

`ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d`

## Semantic consequence

This runtime artifact does not itself implement durable operation idempotency, cancellation acknowledgement, or external-side-effect fencing.

The verified acceptance result `FIRST -> FIRST_COMPLETE -> DUPLICATE_BLOCKED` therefore remains control-plane evidence for the specific accepted test, not proof that arbitrary commands executed through this bridge have universal exactly-once semantics.

Executor hardening must be layered on this recovered production boundary rather than replacing it with an unrelated reference executor.
