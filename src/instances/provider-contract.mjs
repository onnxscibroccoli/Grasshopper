export const INSTANCE_PROVIDERS = Object.freeze(["memory", "android-worker", "kvm", "container", "edge-android", "android-emulator"]);

const REQUIRED = ["provision", "start", "stop", "destroy", "inspect"];

export function assertProvider(provider) {
  if (!provider || typeof provider !== "object") throw new TypeError("provider must be an object");
  for (const method of REQUIRED) if (typeof provider[method] !== "function") throw new TypeError("provider missing " + method);
  if (typeof provider.name !== "string" || !INSTANCE_PROVIDERS.includes(provider.name)) throw new Error("unsupported instance provider: " + String(provider.name));
  return provider;
}

export function providerResult(provider, operation, result = {}) {
  assertProvider(provider);
  return {
    provider: provider.name,
    operation,
    ok: result.ok !== false,
    state: result.state || null,
    resourceId: result.resourceId || null,
    capabilities: Array.isArray(result.capabilities) ? [...result.capabilities] : [],
    profile: result.profile || null,
    evidence: result.evidence || null
  };
}

export function instanceCapabilities(instance = {}) {
  const desired = instance.desired || {};
  const caps = new Set(Array.isArray(desired.capabilities) ? desired.capabilities : []);
  if (instance.kind === "android" || instance.provider === "android-worker" || instance.provider === "android-emulator") {
    caps.add("android.actions"); caps.add("native-return");
  }
  return [...caps].sort();
}
