import { now } from "../model.mjs";
import { assertProvider, providerResult } from "./provider-contract.mjs";

export const ANDROID_EMULATOR_PROFILES = Object.freeze({
  "phone-mirror": Object.freeze({
    id: "phone-mirror",
    kind: "mirror",
    capabilities: ["android.actions", "browser", "native-return", "phone-mirror"],
    rootRequired: false,
  }),
  "rooted-dev": Object.freeze({
    id: "rooted-dev",
    kind: "development",
    capabilities: ["android.actions", "browser", "root", "rooted-development", "virtual-display"],
    rootRequired: true,
  }),
});

function profileFor(instance) {
  const profileId = instance.desired?.androidProfile || instance.androidProfile;
  const profile = ANDROID_EMULATOR_PROFILES[profileId];
  if (!profile) throw new Error("android emulator requires androidProfile: phone-mirror|rooted-dev");
  return profile;
}

function assertRuntime(runtime) {
  if (!runtime || typeof runtime !== "object") throw new TypeError("android emulator runtime is required");
  for (const method of ["provision", "start", "stop", "destroy", "inspect"]) {
    if (typeof runtime[method] !== "function") throw new TypeError("android emulator runtime missing " + method);
  }
  return runtime;
}

export class AndroidEmulatorProvider {
  constructor({ runtime } = {}) {
    this.name = "android-emulator";
    this.runtime = assertRuntime(runtime);
  }

  async provision(instance) {
    const profile = profileFor(instance);
    const result = await this.runtime.provision({ instance, profile });
    if (result?.ok === false) return providerResult(this, "provision", result);
    return providerResult(this, "provision", {
      ...result,
      resourceId: result.resourceId || "android_" + instance.id,
      state: result.state || "stopped",
      capabilities: [...new Set([...(result.capabilities || []), ...profile.capabilities])].sort(),
      profile: profile.id,
      provisionedAt: now(),
      evidence: result.evidence || "runtime-adapter",
    });
  }

  async start(instance) {
    const profile = profileFor(instance);
    if (profile.rootRequired && instance.desired?.rooted !== true) {
      return providerResult(this, "start", {
        ok: false,
        state: "degraded",
        evidence: "rooted-dev profile requires desired.rooted=true",
      });
    }
    const result = await this.runtime.start({ instance, profile });
    if (result?.ok === false) return providerResult(this, "start", result);
    return providerResult(this, "start", {
      ...result,
      state: result.state || "ready",
      resourceId: result.resourceId || "android_" + instance.id,
      capabilities: [...new Set([...(result.capabilities || []), ...profile.capabilities])].sort(),
      profile: profile.id,
      evidence: result.evidence || "runtime-adapter",
    });
  }

  async stop(instance) {
    return providerResult(this, "stop", await this.runtime.stop({ instance, profile: profileFor(instance) }));
  }

  async destroy(instance) {
    return providerResult(this, "destroy", await this.runtime.destroy({ instance, profile: profileFor(instance) }));
  }

  async inspect(instance) {
    const profile = profileFor(instance);
    const result = await this.runtime.inspect({ instance, profile });
    if (result?.ok === false) return providerResult(this, "inspect", result);
    return providerResult(this, "inspect", {
      ...result,
      capabilities: [...new Set([...(result.capabilities || []), ...profile.capabilities])].sort(),
      profile: profile.id,
    });
  }
}

export function createAndroidEmulatorProvider(options = {}) {
  const provider = new AndroidEmulatorProvider(options);
  assertProvider(provider);
  return provider;
}
