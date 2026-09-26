import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateStore } from "../src/store.mjs";
import { ControlPlane } from "../src/control-plane.mjs";
import { DeterministicExecutor } from "../src/executor.mjs";

test("interrupted execution is indeterminate, not a confirmed failure", async () => {
  const executor = new DeterministicExecutor();
  const execution = await executor.start({ id: "task-interrupt", operationKey: "op-interrupt", command: "interrupt: external side effect" });
  assert.equal(execution.result.completion, "indeterminate");
  assert.equal(execution.result.interrupted, true);
  assert.equal(execution.result.code, null);
});

test("control plane does not report interrupted execution as completed or failed", async () => {
  const d = await mkdtemp(join(tmpdir(), "omnikali-"));
  const store = new StateStore(join(d, "state.json"));
  const cp = new ControlPlane(store, new DeterministicExecutor());
  await cp.registerAgent({ name: "a", environment: "local" });
  const agentId = Object.keys((await store.load()).agents)[0];
  const task = await cp.createTask({ agentId, command: "interrupt: network loss", operationKey: "op-network" });
  assert.equal(task.state, "orphaned");
  assert.equal(task.execution.result.completion, "indeterminate");
  await rm(d, { recursive: true, force: true });
});
