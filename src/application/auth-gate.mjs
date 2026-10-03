const SCHEMA = "omnikali.auth-gate/v1";
const RELAY_SCHEMA = "omnikali.auth-gate-relay/v1";
const RESUME_SCHEMA = "omnikali.auth-gate-resume/v1";

export const AUTH_GATE_STATES = Object.freeze([
  "DETECTED",
  "WAITING_FOR_USER",
  "VERIFYING",
  "RESUMED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);

export const AUTH_GATE_EVENTS = Object.freeze({
  USER_NOTIFIED: "auth.gate.user-notified",
  USER_COMPLETED: "auth.gate.user-completed",
  VERIFIED: "auth.gate.verified",
  VERIFICATION_FAILED: "auth.gate.verification-failed",
  CANCELLED: "auth.gate.cancelled",
  EXPIRED: "auth.gate.expired",
});

const TERMINAL = new Set(["RESUMED", "FAILED", "CANCELLED", "EXPIRED"]);
const FORBIDDEN_EVENT_KEY = /(?:^|_)(?:access|refresh|id)?_?token$|password|passwd|cookie|authorization|bearer|secret|otp|captcha.?answer|verification.?code/i;
const MODES = new Set(["SAME_SESSION", "OAUTH_DEVICE"]);

function iso(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("invalid timestamp");
  return date.toISOString();
}

function text(value, name, { required = false, max = 512 } = {}) {
  if (value == null || value === "") {
    if (required) throw new TypeError(name + " is required");
    return null;
  }
  if (typeof value !== "string" || value.length > max) throw new TypeError("invalid " + name);
  return value;
}

function hasForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  return Object.entries(value).some(([key, nested]) =>
    (key !== "credentialRef" && FORBIDDEN_EVENT_KEY.test(key)) || hasForbiddenKey(nested)
  );
}

function freezeGate(gate) {
  return Object.freeze({
    ...gate,
    history: Object.freeze(gate.history.map(item => Object.freeze({ ...item }))),
  });
}

function transition(gate, state, eventType, extra = {}) {
  return freezeGate({
    ...gate,
    ...extra,
    state,
    updatedAt: iso(),
    history: [...gate.history, { type: eventType, at: iso() }],
  });
}

function assertGate(gate) {
  if (!gate || gate.schema !== SCHEMA || !AUTH_GATE_STATES.includes(gate.state)) {
    throw new TypeError("an omnikali auth gate is required");
  }
}

export function createAuthGate(boundary, {
  gateId = null,
  taskId = null,
  sessionRef,
  provider = "generic",
  mode = "SAME_SESSION",
  checkpoint = null,
  createdAt = Date.now(),
  expiresAt = Date.now() + 5 * 60 * 1000,
} = {}) {
  if (!boundary || boundary.status !== "HUMAN_REQUIRED") {
    throw new TypeError("a HUMAN_REQUIRED boundary is required");
  }
  if (!MODES.has(mode)) throw new TypeError("invalid auth gate mode");

  const created = iso(createdAt);
  const expires = iso(expiresAt);
  if (Date.parse(expires) <= Date.parse(created)) throw new TypeError("auth gate expiry must be after creation");

  const gate = {
    schema: SCHEMA,
    id: text(gateId, "gateId") || "gate_" + crypto.randomUUID(),
    taskId: text(taskId, "taskId"),
    sessionRef: text(sessionRef, "sessionRef", { required: true }),
    provider: text(provider, "provider", { required: true, max: 120 }),
    mode,
    reason: boundary.reason,
    state: "DETECTED",
    checkpoint,
    credentialRef: null,
    verificationAttempts: 0,
    createdAt: created,
    updatedAt: created,
    expiresAt: expires,
    history: [{ type: "auth.gate.detected", at: created }],
  };

  return freezeGate(gate);
}

export function applyAuthGateEvent(gate, event = {}) {
  assertGate(gate);
  if (!event || typeof event !== "object" || Array.isArray(event) || typeof event.type !== "string") {
    throw new TypeError("auth gate event is required");
  }
  if (hasForbiddenKey(event)) {
    throw new Error("auth gate events must not contain credentials, challenge answers, cookies, or raw tokens");
  }

  if (gate.state === "RESUMED" && event.type === AUTH_GATE_EVENTS.VERIFIED) {
    const sameSession = event.sessionRef === gate.sessionRef;
    const sameCredential = (event.credentialRef ?? null) === (gate.credentialRef ?? null);
    if (sameSession && sameCredential) return gate;
    throw new Error("conflicting duplicate auth verification");
  }

  if (TERMINAL.has(gate.state)) {
    if (
      (gate.state === "CANCELLED" && event.type === AUTH_GATE_EVENTS.CANCELLED) ||
      (gate.state === "EXPIRED" && event.type === AUTH_GATE_EVENTS.EXPIRED)
    ) return gate;
    throw new Error("auth gate is terminal: " + gate.state);
  }

  if (Date.now() >= Date.parse(gate.expiresAt) && event.type !== AUTH_GATE_EVENTS.EXPIRED) {
    throw new Error("auth gate expired; emit auth.gate.expired before continuing");
  }

  switch (event.type) {
    case AUTH_GATE_EVENTS.USER_NOTIFIED:
      if (gate.state !== "DETECTED") throw new Error("user notification requires DETECTED");
      return transition(gate, "WAITING_FOR_USER", event.type);

    case AUTH_GATE_EVENTS.USER_COMPLETED:
      if (gate.state !== "WAITING_FOR_USER") throw new Error("user completion requires WAITING_FOR_USER");
      return transition(gate, "VERIFYING", event.type, {
        verificationAttempts: gate.verificationAttempts + 1,
      });

    case AUTH_GATE_EVENTS.VERIFIED: {
      if (gate.state !== "VERIFYING") throw new Error("verification requires VERIFYING");
      const sessionRef = text(event.sessionRef, "event.sessionRef", { required: true });
      if (sessionRef !== gate.sessionRef) {
        throw new Error("auth verification must come from the original session");
      }
      if (event.verified !== true) throw new Error("auth verification requires verified=true");
      const credentialRef = text(event.credentialRef, "event.credentialRef");
      return transition(gate, "RESUMED", event.type, { credentialRef });
    }

    case AUTH_GATE_EVENTS.VERIFICATION_FAILED:
      if (gate.state !== "VERIFYING") throw new Error("verification failure requires VERIFYING");
      return transition(
        gate,
        event.retryable === false ? "FAILED" : "WAITING_FOR_USER",
        event.type,
      );

    case AUTH_GATE_EVENTS.CANCELLED:
      return transition(gate, "CANCELLED", event.type);

    case AUTH_GATE_EVENTS.EXPIRED:
      return transition(gate, "EXPIRED", event.type);

    default:
      throw new Error("unsupported auth gate event: " + event.type);
  }
}

export function authGateDisposition(gate) {
  assertGate(gate);
  if (gate.state === "RESUMED") return "RESUME";
  if (["FAILED", "CANCELLED", "EXPIRED"].includes(gate.state)) return "HALT";
  return "PAUSE";
}

export function createAuthGateRelayView(gate) {
  assertGate(gate);
  return Object.freeze({
    schema: RELAY_SCHEMA,
    gateId: gate.id,
    taskId: gate.taskId,
    provider: gate.provider,
    mode: gate.mode,
    reason: gate.reason,
    state: gate.state,
    createdAt: gate.createdAt,
    expiresAt: gate.expiresAt,
    requiresUserPresence: true,
    message: gate.mode === "OAUTH_DEVICE"
      ? "Authorization is required. Open the trusted provider authorization surface on your phone and complete it there. Chat confirmation alone does not resume automation."
      : "User action is required. Open the trusted OmniKali session on your phone and complete the challenge in the original session. Chat confirmation alone does not resume automation.",
  });
}

export function createAuthGateResumeEvent(gate) {
  assertGate(gate);
  if (gate.state !== "RESUMED") throw new Error("auth gate has not been verified");
  return Object.freeze({
    schema: RESUME_SCHEMA,
    type: "human.boundary.cleared",
    gateId: gate.id,
    taskId: gate.taskId,
    sessionRef: gate.sessionRef,
    credentialRef: gate.credentialRef,
    checkpoint: gate.checkpoint,
    verifiedAt: gate.updatedAt,
  });
}
