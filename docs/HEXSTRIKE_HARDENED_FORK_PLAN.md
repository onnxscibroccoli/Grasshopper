# HexStrike Hardened Fork Plan

Status: implementation gate, 2026-09-29.

The intended HexStrike integration is **not** to declare upstream unsafe. HexStrike is an authorized-security-testing framework. The requirement is to maintain an OmniKali-owned, reviewed fork so production behavior is pinned, auditable, and compatible with Helix's control-plane contract.

## Source lineage

1. Record the exact upstream repository: `0x4m4/hexstrike-ai`.
2. Record the exact source commit used for the fork.
3. Preserve upstream LICENSE, attribution, and history.
4. Keep upstream synchronization explicit. Never silently replace reviewed code with moving `master`.
5. Every fork update requires the same review gate as an application dependency.

## Mandatory fork controls

### Network

- Bind the service only to its private worker network.
- Do not publish port 8888 through CloudFront.
- Helix is the only public control-plane path.
- MCP transport must remain private to the worker boundary.

### Authentication

- Require a non-empty API credential for every HTTP control endpoint.
- Reject missing, malformed, and invalid credentials before dispatch.
- Do not log credentials or authorization headers.
- Rotate the fork's service credential independently of LLM/provider credentials.

### Target authorization

HexStrike must receive an already-authorized task envelope from Helix.

The fork must not invent or broaden target scope.

Every tool invocation must resolve to:

- task ID;
- operation key;
- authorized target/profile;
- workspace;
- deadline;
- audit correlation ID.

Reject requests that bypass the normalized envelope.

### Command/tool dispatch

Review every route that can result in process execution, including generic command routes and tool-specific routes.

Required properties:

- no shell interpolation from untrusted request fields;
- structured argument construction;
- explicit executable/tool allowlisting;
- target validation before execution;
- bounded argument sizes;
- bounded process lifetime;
- bounded output;
- deterministic cancellation;
- non-zero exit propagation;
- audit record for each invocation.

Do not treat a single command-validation regex as the security boundary.

### Filesystem

The worker receives only its assigned workspace and explicitly required read-only tool data.

Do not mount:

- Helix source;
- PostgreSQL credentials;
- QEMU/libvirt sockets;
- host root;
- the host Docker socket.

### Resource controls

The hardened image must have explicit CPU, memory, PID, temporary-storage, and process-time limits.

High-resource tools must not be allowed to exhaust the host.

### Audit

Emit structured events without secrets:

- request accepted/rejected;
- authenticated principal;
- task ID;
- operation key;
- target/profile;
- tool name;
- start/end;
- exit status;
- cancellation;
- bounded result metadata.

## Review gates

A fork candidate is not enabled until:

1. source commit is recorded;
2. security-sensitive routes have been reviewed;
3. dependency lock/pinning is recorded;
4. authentication tests pass;
5. unauthorized-target tests pass;
6. command-dispatch regression tests pass;
7. file-boundary tests pass;
8. resource-limit tests pass;
9. secret-redaction tests pass;
10. container image is built from the reviewed commit;
11. image digest is recorded;
12. Helix integration passes against a disposable authorized target;
13. cancellation and worker-loss recovery pass;
14. no production deployment occurs before all gates are green.

## Initial upstream review set

Current upstream activity contains security-related work around:

- fail-closed authentication and scope enforcement;
- localhost binding;
- command/tool argument injection;
- reproducibility;
- dependency/runtime fixes.

These changes must be reviewed by behavior and tests, not blindly cherry-picked. The fork should converge on the security properties we require, while retaining HexStrike functionality.

## Deployment sequence

```
0x4m4/hexstrike-ai
        |
        | pinned source commit
        v
OmniKali HexStrike fork
        |
        | security review + tests
        v
immutable container image
        |
        | private worker network
        v
Helix HexStrike adapter
        |
        | normalized authorized task
        v
Kali/security worker
```

The final acceptance target is a disposable local/owned test asset. Public CloudFront exposure remains limited to Helix.
