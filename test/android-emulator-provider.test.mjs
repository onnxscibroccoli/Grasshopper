import test from "node:test";
import assert from "node:assert/strict";
import { createAndroidEmulatorProvider } from "../src/instances/android-emulator-provider.mjs";

function runtimeHarness() {
  const calls = [];
  const runtime = {};
  for (const method of ["provision", "start", "stop", "destroy", "inspect"]) {
    runtime[method] = async input => {
      calls.push({ method, input });
      return {
        ok: true,
        state: method === "inspect" ? "ready" : method === "start" ? "ready" : "stopped",
        resourceId: "emu_i1",
        capabilities: ["frame-capture"],
      };
    };
  }
  return { runtime, calls };
}

test("phone-mirror profile is explicit and never claims root", async () => {
  const { runtime, calls } = runtimeHarness();
  const provider = createAndroidEmulatorProvider({ runtime });
  const result = await provider.provision({ id: "i1", desired: { androidProfile: "phone-mirror" } });
  assert.equal(result.provider, "android-emulator");
  assert.equal(result.profile, "phone-mirror");
  assert.equal(result.capabilities.includes("phone-mirror"), true);
  assert.equal(result.capabilities.includes("root"), false);
  assert.equal(calls[0].input.profile.rootRequired, false);
});

test("rooted-dev requires an explicit rooted capability request", async () => {
  const { runtime } = runtimeHarness();
  const provider = createAndroidEmulatorProvider({ runtime });
  const blocked = await provider.start({ id: "i1", desired: { androidProfile: "rooted-dev", rooted: false } });
  assert.equal(blocked.ok, false);
  assert.match(blocked.evidence, /requires desired\.rooted=true/);
  const started = await provider.start({ id: "i1", desired: { androidProfile: "rooted-dev", rooted: true } });
  assert.equal(started.ok, true);
  assert.equal(started.profile, "rooted-dev");
  assert.equal(started.capabilities.includes("root"), true);
});

test("unknown emulator profiles fail closed", async () => {
  const { runtime } = runtimeHarness();
  const provider = createAndroidEmulatorProvider({ runtime });
  await assert.rejects(() => provider.inspect({ id: "i1", desired: { androidProfile: "unknown" } }), /android emulator requires androidProfile/);
});

test("runtime disappearance remains degraded instead of ready", async () => {
  const runtime = {
    provision: async () => ({ ok: true, state: "stopped", resourceId: "emu_i1" }),
    start: async () => ({ ok: true, state: "ready", resourceId: "emu_i1" }),
    stop: async () => ({ ok: true, state: "stopped", resourceId: "emu_i1" }),
    destroy: async () => ({ ok: true, state: "destroyed", resourceId: "emu_i1" }),
    inspect: async () => ({ ok: false, state: "absent", evidence: "adb-device-missing" }),
  };
  const provider = createAndroidEmulatorProvider({ runtime });
  const result = await provider.inspect({ id: "i1", desired: { androidProfile: "phone-mirror" } });
  assert.equal(result.ok, false);
  assert.equal(result.state, "absent");
});
