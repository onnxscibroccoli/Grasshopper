# OmniKali Authenticated MCP Grid

Status vocabulary is authoritative: PASS, PASS_WITH_NOT_PROVEN, NOT_PROVEN, BROKEN_NEEDS_REIMPLEMENTATION, OPEN, BLOCKED, IN_PROGRESS.

## Design boundary

The MCP control plane is independent of the Cloud Android display plane and independent of the Cloud Android ADB recovery.

- R2 screen plane remains the preserved user plane.
- R2 ADB remains BROKEN_NEEDS_REIMPLEMENTATION until live `adb get-state=device` and an authenticated shell artifact are proven.
- R3 Rish remains NOT_PROVEN until the canonical uid=2000 artifact is generated.
- MCP tools must return explicit evidence state rather than pretending an unavailable transport works.

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
   |-- policy / scope / audit / rate limit
   |-- mTLS to node gateways where supported
   |
   +--> Kali MCP node
   +--> Cloud Android MCP node
   +--> Physical Android MCP node
```

Remote transport: Streamable HTTP is the primary transport. HTTP+SSE is compatibility-only. Local integrations use stdio. The current prototype intentionally exposes stdio only and binds no TCP listener.

## Authentication and authorization

1. Remote clients authenticate at the gateway using OAuth2/OIDC or short-lived service credentials.
2. Gateway issues a narrowly scoped node capability token.
3. Node-to-gateway transport uses mTLS where supported.
4. Every tool call carries an audit identity, node identity, capability scope, request id, and policy decision.
5. No shell command is accepted as an arbitrary string.
6. System execution is represented by typed, allowlisted operations with explicit resource scopes.
7. GUI input is constrained by node/session identifiers and bounded coordinate/key/text schemas.
8. Browser control is constrained to registered browser sessions and approved origins.
9. Screenshots are local artifacts by default. Upload/export is an explicit separate capability.
10. Failure to authenticate, authorize, resolve a session, or prove a transport returns a hard error or NOT_PROVEN result. It never falls back to unauthenticated execution.

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

## Transport promotion gates

- Prototype stdio: IN_PROGRESS
- Streamable HTTP node transport: OPEN
- OAuth/OIDC gateway: OPEN
- mTLS node links: OPEN
- Physical Android node: BLOCKED on R3
- Cloud Android agent plane: BLOCKED on R2 ADB
- Kali workstation node: OPEN pending local capability inventory

No production MCP endpoint is promoted until authentication, authorization, audit logging, and replay-safe request identity are proven.

## Local LLM boundary

Local inference is a capability provider, not a privileged controller. It receives minimum-necessary local artifacts and returns typed decisions.

- ARM64 Linux: llama.cpp or Ollama, CPU/GPU backend selected by detected hardware.
- Cloud Android: prefer llama.cpp/ONNX Runtime only if the guest has sufficient memory; otherwise inference belongs on the ARM64 host.
- Physical Android: llama.cpp/ONNX Runtime with small 1B-3B quantized models; keep models and screenshots local by default.
- VLM use is gated separately from text inference because image handling materially changes resource and privacy requirements.

Model selection is a benchmark gate, not a deployment assumption. A model is not marked optimal until latency, RAM, thermal behavior, tool-call accuracy, and recovery behavior are measured on the actual node.
