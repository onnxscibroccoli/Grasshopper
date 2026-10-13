import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ControlPlane } from "../src/control-plane.mjs";
import { DeterministicExecutor } from "../src/executor.mjs";
import { StateStore } from "../src/store.mjs";

async function plane() {
  const dir = await mkdtemp(join(tmpdir(), "omnikali-instances-"));
  return {
    dir,
    cp: new ControlPlane(new StateStore(join(dir, "state.json")), new DeterministicExecutor())
  };
}

test("persistent and ephemeral instances can coexist and switch independently", async () => {
  const { dir, cp } = await plane();
  try {
    const created = await cp.createInstance({ id: "inst_chat", name: "chat", mode: "persistent", kind: "cloud-android" });
    await cp.createInstance({ id: "inst_private", name: "private", mode: "ephemeral", kind: "cloud-android" });
    await cp.setInstanceReady("inst_chat");
    await cp.setInstanceReady("inst_private");

    await cp.switchInstance("inst_chat");
    let state = await cp.store.load();
    assert.equal(state.activeInstanceId, "inst_chat");

    const task = await cp.createTask({
      id: "task_chat", operationKey: "chat-1", agentId: "missing-agent",
      instanceId: "inst_chat", command: "ok: chat task"
    });
    assert.equal(task.instanceId, "inst_chat");

    await cp.switchInstance("inst_private");
    state = await cp.store.load();
    assert.equal(state.activeInstanceId, "inst_private");

    await cp.destroyInstance("inst_private");
    state = await cp.store.load();
    assert.equal(state.activeInstanceId, null);
    assert.equal(state.instances.inst_private.state, "destroyed");
    await assert.rejects(() => cp.destroyInstance("inst_chat"), /persistent instance/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("tasks cannot target a missing or non-ready instance", async () => {
  const { dir, cp } = await plane();
  try {
    await assert.rejects(() => cp.createTask({
      agentId: "agent", instanceId: "missing", command: "ok"
    }), /unknown instance/);
    await cp.createInstance({ id: "inst", name: "staged", mode: "ephemeral" });
    await assert.rejects(() => cp.createTask({
      agentId: "agent", instanceId: "inst", command: "ok"
    }), /not ready/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
