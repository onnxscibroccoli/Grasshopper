# Security Agent Framework Readiness Matrix

Status: evidence-driven gate, 2026-09-29.

This document records what may be integrated now, what requires an adapter, and what is explicitly blocked. It is not a claim that an upstream framework is production-ready merely because it starts. A framework can be entirely legitimate while still requiring a project-specific reviewed fork and deployment boundary.

## Current gates

| Framework | Phase-1 status | Blocking evidence | Required next gate |
|---|---|---|---|
| Agent Zero | ADAPTER_REQUIRED | Current Docker installation is supported and its persisted state belongs under /a0/usr; a stable automation API contract still needs to be established for Helix rather than coupling Helix to the UI. | Build an internal adapter that accepts the normalized OmniKali task contract and prove a localhost-only authorized test flow. |
| PentestGPT | ADAPTER_REQUIRED | Current upstream Docker image intentionally does not contain the maintained pentestgpt_agent runtime; its own Docker plan says make docker-run is pending runtime wiring. | Build and test a dedicated framework image from the maintained nested project, pin dependencies, and prove a local test-target run. |
| PentAGI | ADAPTER_REQUIRED | Official stack exposes REST/GraphQL APIs and uses Docker-backed worker execution. The default compose also mounts the host Docker socket, which is too broad for the OmniKali production host. | Run with a dedicated worker daemon/socket boundary and a scoped API token; prove flow creation, completion, cancellation, and worker isolation. |
| HexStrike AI | HARDENED_FORK_REQUIRED | Upstream is a powerful security automation framework and currently has open security reports/issues that must be reviewed before we inherit the corresponding code into our production path. This is an integration gate, not a judgment that HexStrike itself is categorically unsafe. | Create a pinned fork from an identified upstream commit; review the security-sensitive command/tool dispatch surfaces; add fail-closed authentication, target/scope enforcement, audit logging, rate limits, resource isolation, and regression tests; then build and validate the fork before enabling the Helix target. |

## Normalized OmniKali task contract

Helix owns:

- authenticated caller identity;
- workspace ownership;
- authorized target policy;
- task idempotency key;
- durable lifecycle and lease state;
- cancellation and fencing;
- result and audit events.

A framework receives only a scoped execution envelope:

    {
      "task_id": "uuid",
      "operation_key": "idempotency-key",
      "framework": "agent-zero|pentestgpt|pentagi|hexstrike",
      "assessment_profile": "named-policy-profile",
      "authorized_targets": ["explicitly-authorized-asset"],
      "workspace": "scoped-workspace",
      "deadline_seconds": 900,
      "input": {}
    }

The framework must not receive arbitrary public requests, Helix database credentials, QEMU/libvirt access, or the host Docker socket unless its dedicated worker architecture explicitly requires a separately isolated daemon.

## API/provider diagnostics

Run checks in order:

1. container DNS;
2. TCP connection;
3. TLS validation;
4. authenticated HTTP request;
5. provider/model identifier;
6. request schema;
7. timeout behavior;
8. rate-limit behavior;
9. retry behavior;
10. log redaction.

Never print the credential while diagnosing an API failure.

## Phase ordering

### Phase 1: existing Kali host

The existing CloudFront -> nginx -> Helix -> Kali path remains the public control surface. Frameworks stay private to the host and receive tasks only from Helix.

Use a disposable local authorization target first. Do not use a public third-party target for acceptance tests.

### Phase 2: Docker-native

Each framework receives its own immutable image, workspace, resource limits, internal network identity, and secret namespace. Host filesystem and Docker socket access are denied by default.

### Phase 3: Kubernetes

Each framework becomes a separately deployable workload. Default-deny NetworkPolicies, externalized secrets, resource limits, immutable image digests, and isolated worker node pools are mandatory. High-risk assessment workers must not share the control-plane node pool.

## Production readiness rule

A framework remains disabled until all of these are proven:

- authenticated provider connection;
- authorized target enforcement;
- Helix idempotency;
- task lifecycle completion;
- cancellation fencing;
- worker termination recovery;
- stale lease recovery without duplicate execution;
- secret-free logs;
- no unnecessary host capability;
- deterministic result collection.

## Known external evidence

- Agent Zero documents direct Docker installation and persistence under /a0/usr.
- PentestGPT's current Docker plan explicitly records that the maintained nested agent is not baked into its current image.
- PentAGI documents REST/GraphQL API access and its default Compose stack mounts /var/run/docker.sock for worker execution.
- HexStrike's current upstream repository has open security reports and security-hardening pull requests. Our treatment is to review the relevant code and produce a pinned hardened fork, not to label the upstream project itself unsafe.

Those facts are used as integration constraints, not as claims that a particular upstream release is permanently unsafe or safe. Re-check them at each pinned revision. The intended HexStrike path is upstream -> reviewed fork -> immutable image -> Helix adapter -> authorized worker.