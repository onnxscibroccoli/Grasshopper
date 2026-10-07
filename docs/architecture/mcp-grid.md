# OmniKali Authenticated MCP Grid

Status vocabulary is authoritative: PASS, PASS_WITH_NOT_PROVEN, NOT_PROVEN, BROKEN_NEEDS_REIMPLEMENTATION, OPEN, BLOCKED, IN_PROGRESS.

## Design boundary

The MCP control plane is independent of the Cloud Android display plane and independent of the Cloud Android transport implementation.

- R2 Cloud Android development transport is PASS. Fresh evidence proves authenticated ADB `device`, screenshot capture, input, persistence, and loopback-only listeners.
- R3 RDC -> Termux -> Rish transport is PASS. Fresh evidence proves the canonical uid=2000 shell artifact through the existing `lib/rish_run.sh` with `RISH_PRESERVE_ENV=0`.
- MCP tools must return explicit evidence state rather than pretending an unavailable capability works.
- Higher-level capabilities remain individually gated. Passing the transport does not automatically prove browser automation, Ruto, physical screen reconnect, or production gateway deployment.

Evidence:

- `docs/operations/CLOUD_ANDROID_R2_REVERIFICATION_2026-10-06.md`
- `docs/operations/R3_RISH_REVERIFICATION_2026-10-06.md`

## Node topology

Each node has a local capability daemon:

`physical-android`, `cloud-android`, `kali-workstation`.

The local daemon owns only node-local capabilities. A separate grid gateway is the trust boundary for remote AI providers.

```
AI provider
   |
   | OAuth2/OIDC or short-lived service credential
   v
Authenticated MCP Grid Gateway
   |-- authentication / policy / scope / audit / rate limit
   |-- replay-safe request identity
   |-- mTLS to node gateways where supported
   |
   +--> Kali MCP node
   +--> Cloud Android MCP node
   +--> Physical Android MCP node
```

Remote transport: Streamable HTTP is the primary transport. HTTP+SSE is compatibility-only. Local integrations use stdio. The current gateway prototype is loopback-only and uses a development bearer verifier; it is not production OAuth/OIDC.

## Authentication and authorization

1. Remote clients authenticate at the gateway using OAuth2/OIDC or short-lived service credentials in the production design.
2. The current development gateway uses a static development bearer token only to prove the HTTP authentication boundary. It refuses to start without that token and is explicitly marked non-production.
3. Gateway issues a narrowly scoped node capability token in the production design.
4. Node-to-gateway transport uses mTLS where supported.
5. Every tool call carries an audit identity, node identity, capability scope, request id, and policy decision.
6. No shell command is accepted as an arbitrary string.
7. System execution is represented by typed, allowlisted operations with explicit resource scopes.
8. GUI input is constrained by node/session identifiers and bounded coordinate/key/text schemas.
9. Browser control is constrained to registered browser sessions and approved origins.
10. Screenshots are local artifacts by default. Upload/export is an explicit separate capability.
11. Failure to authenticate, authorize, resolve a session, or prove a transport returns a hard error or NOT_PROVEN result. It never falls back to unauthenticated execution.

## Initial tool contract

### gui.capture

Inputs: session_id, max_bytes.

Returns: artifact reference, SHA-256, dimensions, capture timestamp, evidence status.

### gui.input

Inputs: session_id, action=(tap|swipe|key|type), typed parameters.

Returns: action id and evidence status. It must not silently fall back from ADB to another transport.

### gui.tree

Inputs: session_id.

Returns: accessibility/UI tree artifact reference and evidence status.

### web.navigate

Inputs: browser_session_id, URL.

Policy checks scheme, host allowlist, and browser-session ownership before navigation.

### web.evaluate

Inputs: browser_session_id, operation from an allowlisted operation enum.

Arbitrary JavaScript execution is disabled in the initial contract.

### system.exec

Inputs: operation enum plus typed arguments. There is no `command` or shell string field.

Initial prototype exposes this tool as NOT_PROVEN until a node-specific executor is registered.

### node.status

Returns current capability evidence without mutating the node.

### gateway.status

Returns authenticated gateway evidence without mutating a node. It reports the authentication mode and deliberately does not claim node execution.

## Transport promotion gates

- Prototype stdio: PASS for the local fail-closed foundation.
- Streamable HTTP gateway transport: IN_PROGRESS. The development gateway is executable, authenticated, loopback-only, and covered by contract tests.
- OAuth/OIDC production gateway: OPEN. The development verifier must be replaced by the real authorization-server verifier before production promotion.
- mTLS node links: OPEN.
- Physical Android node: OPEN for R3 transport, higher-level GUI capability still separate.
- Cloud Android agent plane: PASS for R2 development transport, higher-level MCP capability still separate.
- Kali workstation node: OPEN pending local capability inventory and registration.

No production MCP endpoint is promoted until authentication, authorization, audit logging, replay-safe request identity, node admission, and capability-specific live acceptance are proven.

## Local LLM boundary

Local inference is a capability provider, not a privileged controller. It receives minimum-necessary local artifacts and returns typed decisions.

- ARM64 Linux: llama.cpp or Ollama, CPU/GPU backend selected by detected hardware.
- Cloud Android: prefer llama.cpp/ONNX Runtime only if the guest has sufficient memory; otherwise inference belongs on the ARM64 host.
- Physical Android: llama.cpp/ONNX Runtime with small 1B-3B quantized models; keep models and screenshots local by default.
- VLM use is gated separately from text inference because image handling materially changes resource and privacy requirements.

Model selection is a benchmark gate, not a deployment assumption. A model is not marked optimal until latency, RAM, thermal behavior, tool-call accuracy, and recovery behavior are measured on the actual node.
