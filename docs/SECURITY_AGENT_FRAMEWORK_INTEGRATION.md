# Agentic Security Framework Integration

Status: architecture and integration plan, 2026-09-29.

## Boundary

The public surface remains:

CloudFront -> nginx -> Helix gateway -> authenticated task/control plane -> guest executor -> Kali.

Agent Zero, PentestGPT, PentAGI, and HexStrike AI are **not public origins** and are not mounted directly into CloudFront. During Phase 1 they run on the existing Kali host as isolated local services/containers. Helix is the policy boundary and task broker.

Only authorized security-testing assets may be assessed. Default target policy is deny-until-authorized.

## Framework matrix

| Framework | Primary role | Upstream container base | Phase 1 placement |
|---|---|---|---|
| Agent Zero | general computer-use/agent orchestration | upstream A0 image based on its maintained base image; use `agent0ai/agent-zero` rather than rebuilding it initially | isolated container, localhost-only |
| PentestGPT | task-oriented pentest/CTF agent | Ubuntu 24.04, Python 3.12, Node 20 | isolated disposable container |
| PentAGI | multi-agent pentest orchestration | upstream multi-stage build; final runtime Alpine 3.23.x | isolated service plus its own worker containers |
| HexStrike AI | MCP/security-tool bridge | Kali Linux is the preferred execution base because the project expects a broad Kali-style tool inventory | isolated MCP/tool container |

Do not merge these images into the Helix gateway image.

## API configuration contract

Secrets never belong in git, Dockerfiles, Kubernetes manifests, task payloads, or CloudFront URLs.

Use one secret namespace per environment:

- development/disposable
- reconstruction
- production

Provider configuration should be injected at runtime. Validate:

1. DNS resolution from the service container.
2. TCP/TLS connectivity to the provider.
3. Authentication without logging the credential.
4. Model/provider identifier.
5. Request timeout.
6. Response status and content type.
7. Rate-limit behavior.
8. Retry behavior.
9. redaction of authorization headers and API keys.

A provider health check must report metadata such as provider, endpoint host, model, latency, and HTTP status, but never the secret.

## Phase 1: existing Kali host

### Network layout

Use a dedicated local bridge network:

`helix-control` -> framework services -> disposable tool workers.

Only nginx/Helix has a public listener. Framework services bind to loopback or an internal Docker network.

Do not expose:
- Docker socket to Agent Zero or HexStrike unless a specific worker-management feature requires it.
- host SSH.
- QEMU monitor.
- libvirt socket.
- PostgreSQL.
- MCP ports directly to the Internet.

PentAGI is the exception that may require controlled Docker worker access. Prefer a separate Docker daemon or a tightly scoped worker host over exposing the production Docker socket.

### Agent Zero

Use the upstream `agent0ai/agent-zero` image. Persist only `/a0/usr`; do not mount the entire application tree.

Dependency rule:
- keep A0's framework runtime untouched;
- configure models with its `A0_SET_*` variables or UI;
- keep API credentials in the runtime secret store;
- verify container -> provider connectivity before enabling tools.

Troubleshooting:
- 401/403: verify provider/key pairing and that the key is actually available inside the container.
- timeout: test DNS/TCP from inside the container, then provider endpoint latency.
- model-not-found: query the provider's model list and use the exact returned identifier.
- host access failure: do not add privileged mounts first; verify the intended A0 CLI/host bridge path.
- settings not changing: A0 documents that persisted settings can override environment defaults; restart after environment changes.

### PentestGPT

Use the upstream Dockerfile as the baseline: Ubuntu 24.04, Python 3.12, Node 20, uv, Claude Code, and Codex.

Dependency workflow:
1. build the image;
2. run `make check` and `make test`;
3. keep provider login state in a dedicated volume;
4. keep workspace in a separate volume;
5. never bake provider credentials into the image.

API troubleshooting:
- first test the CLI authentication inside the container;
- then test the selected backend/model independently;
- then run PentestGPT against an intentionally local test target;
- if Docker starts but the CLI is absent, inspect the project's Docker plan before adding packages manually, because the maintained nested agent is intentionally not baked into some current images.

### PentAGI

Use the official multi-stage build. Its current final runtime is Alpine 3.23.x, while the frontend and Go builds occur in earlier stages.

PentAGI uses Docker for isolated terminal/worker execution. Treat Docker daemon access as a high-risk capability.

Dependency workflow:
- configure at least one supported LLM provider;
- configure search providers separately;
- configure pgvector/other bundled services through the supplied compose files;
- start the base compose stack before optional observability/Graphiti/Langfuse stacks.

API troubleshooting:
- inspect the container logs first;
- verify the configured provider endpoint from inside the PentAGI container;
- verify the worker Docker connection separately from the main API;
- keep `DOCKER_INSIDE`, `DOCKER_SOCKET`, `DOCKER_NETWORK`, and related variables explicit;
- do not solve Docker failures by granting privileged mode or unrestricted host networking.

### HexStrike AI

Use a Kali-based image for Phase 1 because its tool inventory depends on Kali and external security utilities.

Keep the MCP server on an internal network. Enable API authentication and command validation before allowing any agent to call it.

Dependency workflow:
- Python virtual environment/locked image dependencies;
- install only the tool categories required by the current assessment profile;
- expose a health endpoint internally;
- use a dedicated tool workspace and results volume.

API/MCP troubleshooting:
1. `GET /health` internally.
2. verify the configured bind address.
3. verify API-key authentication if enabled.
4. verify the MCP bridge can reach the server.
5. verify the selected tool exists in the image.
6. inspect tool exit status separately from MCP transport status.
7. preserve command validation and rate limiting.

## Common API diagnostic sequence

Never start by changing credentials.

```text
container DNS
  -> TCP connection
  -> TLS certificate
  -> HTTP status
  -> authentication
  -> model/tool identifier
  -> request schema
  -> timeout
  -> retry/rate-limit behavior
```

A failure at an earlier layer makes later layers meaningless.

## Phase 2: Docker-native production

Convert each framework into a separately versioned image with:
- immutable image digest;
- non-root runtime where supported;
- read-only root filesystem where supported;
- dedicated writable workspace;
- explicit CPU/memory/PID limits;
- no host network;
- no host filesystem mounts;
- no Docker socket unless the worker architecture requires it;
- internal service discovery only.

Helix remains the policy/control plane. Frameworks receive scoped task contracts, not arbitrary public requests.

## Phase 3: Kubernetes

Map the architecture to:

- namespace per environment;
- NetworkPolicies default-deny;
- one Deployment/Job family per framework;
- separate worker Jobs for tool execution;
- Secrets or external secret provider;
- resource requests/limits;
- Pod Security Admission restricted where compatible;
- service-to-service mTLS if required;
- immutable image digests;
- audit events returned to Helix;
- ephemeral assessment namespaces for high-risk tool chains.

Do not put privileged pentest workers in the same node pool as the control plane.

## Acceptance gates

A framework is not production-ready merely because its container starts.

Each integration must prove:

1. health endpoint works;
2. provider authentication works without secret leakage;
3. authorized local target can be reached;
4. task enters Helix with an idempotency key;
5. task executes in the intended worker;
6. result returns through the control plane;
7. cancellation is fenced;
8. worker termination is recoverable;
9. stale lease cannot cause duplicate execution;
10. logs contain no API credentials;
11. container cannot reach control-plane sockets it does not need;
12. unauthorized target is rejected by policy.

The first implementation target is the existing Kali host. Kubernetes is a later deployment substrate, not a prerequisite for validating the control-plane contract.
