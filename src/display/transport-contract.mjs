export const DISPLAY_TRANSPORTS = Object.freeze(["cuttlefish-webrtc", "scrcpy", "websocket", "none"]);
export const DISPLAY_STATES = Object.freeze(["idle", "starting", "ready", "stopped", "degraded"]);

const REQUIRED = ["start", "stop", "inspect"];

export function assertDisplayTransport(transport) {
  if (!transport || typeof transport !== "object") throw new TypeError("display transport must be an object");
  for (const method of REQUIRED) {
    if (typeof transport[method] !== "function") throw new TypeError("display transport missing " + method);
  }
  if (!DISPLAY_TRANSPORTS.includes(transport.name)) {
    throw new Error("unsupported display transport: " + String(transport.name));
  }
  return transport;
}

export function transportResult(transport, operation, result = {}) {
  assertDisplayTransport(transport);
  const state = result.state || (result.ok === false ? "degraded" : "idle");
  if (!DISPLAY_STATES.includes(state)) throw new Error("invalid display transport state: " + state);
  return {
    transport: transport.name,
    operation,
    ok: result.ok !== false,
    state,
    resourceId: result.resourceId || null,
    endpoint: result.endpoint || null,
    capabilities: Array.isArray(result.capabilities) ? [...result.capabilities].sort() : [],
    evidence: result.evidence || null
  };
}

export function assertLiveFrameEvidence(result) {
  if (!result || result.ok !== true || result.state !== "ready") {
    throw new Error("live frame transport is not proven");
  }
  if (!result.evidence || result.evidence.status !== "PASS") {
    throw new Error("live frame transport requires PASS evidence");
  }
  if (!result.evidence.bidirectional) throw new Error("live frame transport requires bidirectional evidence");
  if (!result.evidence.framesObserved) throw new Error("live frame transport requires observed frames");
  return result;
}
