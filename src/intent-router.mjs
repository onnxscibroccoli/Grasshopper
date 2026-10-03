const NATIVE_RETURN_INTENTS = new Set(["open-native-phone", "return-to-phone", "native-phone"]);
const SWITCH_INTENT = "switch-instance";

export function normalizeIntent(input) {
  if (typeof input === "string") return { name: input, args: {} };
  if (!input || typeof input !== "object" || typeof input.name !== "string") throw new TypeError("intent must have a name");
  return { name: input.name, args: input.args && typeof input.args === "object" ? input.args : {} };
}

export function routeIntent(input) {
  const intent = normalizeIntent(input);
  if (NATIVE_RETURN_INTENTS.has(intent.name)) return { kind: "native-return", name: intent.name };
  if (intent.name === SWITCH_INTENT) {
    if (typeof intent.args.instanceId !== "string" || !intent.args.instanceId) throw new Error("switch-instance requires instanceId");
    return { kind: "instance-switch", instanceId: intent.args.instanceId };
  }
  throw new Error("unsupported intent: " + intent.name);
}

export async function executeIntent(controlPlane, input, { nativeReturn } = {}) {
  const routed = routeIntent(input);
  if (routed.kind === "instance-switch") return controlPlane.switchInstance(routed.instanceId);
  if (typeof nativeReturn !== "function") throw new Error("native-return capability is unavailable");
  return nativeReturn({ reason: "user-intent", intent: routed.name });
}
