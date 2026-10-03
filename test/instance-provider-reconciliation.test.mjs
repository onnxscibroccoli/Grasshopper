import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ControlPlane } from "../src/control-plane.mjs";
import { StateStore } from "../src/store.mjs";
import { DeterministicExecutor } from "../src/executor.mjs";
import { createMemoryProvider } from "../src/instances/memory-provider.mjs";
import { InstanceReconciler } from "../src/instances/reconciler.mjs";

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "omnikali-provider-"));
  const cp = new ControlPlane(new StateStore(join(dir, "state.json")), new DeterministicExecutor());
  const memory = createMemoryProvider();
  return { dir, cp, reconciler: new InstanceReconciler(cp, { memory }) };
}

test("reconciler provisions and starts an instance idempotently", async () => {
  const { dir, cp, reconciler } = await setup();
  try {
    await cp.createInstance({ id: "i1", name: "chat", mode: "persistent", desired: { provider: "memory", running: true, capabilities: ["browser"] } });
    let instance = await reconciler.reconcileInstance("i1");
    assert.equal(instance.state, "ready");
    assert.equal(instance.provider, "memory");
    assert.equal(instance.capabilities.includes("browser"), true);
    instance = await reconciler.reconcileInstance("i1");
    assert.equal(instance.state, "ready");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("ephemeral destroy goes through destroying then destroyed", async () => {
  const { dir, cp, reconciler } = await setup();
  try {
    await cp.createInstance({ id: "i2", name: "tmp", mode: "ephemeral", desired: { provider: "memory", running: true } });
    await reconciler.reconcileInstance("i2");
    const state = await reconciler.destroyInstance("i2");
    assert.equal(state.instances.i2.state, "destroyed");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("provider absence degrades rather than falsely reporting ready", async () => {
  const { dir, cp, reconciler } = await setup();
  try {
    await cp.createInstance({ id: "i3", name: "gone", mode: "persistent", desired: { provider: "memory", running: true } });
    await reconciler.reconcileInstance("i3");
    const provider = reconciler.providers.memory;
    await provider.destroy({ id: "i3" });
    const state = await reconciler.reconcileInstance("i3");
    assert.equal(state.instances.i3.state, "degraded");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
