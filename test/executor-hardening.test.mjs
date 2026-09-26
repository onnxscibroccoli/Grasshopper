import test from "node:test";
import assert from "node:assert/strict";
import { DeterministicExecutor } from "../src/executor.mjs";

test("same operation key returns the existing execution without re-executing", async () => {
  const executor = new DeterministicExecutor();
  let exits = 0;
  const first = await executor.start({ id: "task-a", operationKey: "op-1", command: "ok: once" }, async () => { exits++; });
  const duplicate = await executor.start({ id: "task-b", operationKey: "op-1", command: "ok: duplicate" }, async () => { exits++; });
  assert.equal(first.executionId, duplicate.executionId);
  assert.equal(duplicate.duplicate, true);
  assert.equal(exits, 1);
  assert.equal(first.result.stdout, "once\n");
});

test("cancellation is acknowledged and produces a canceled result", async () => {
  const executor = new DeterministicExecutor();
  let result;
  const execution = await executor.start({ id: "task-hold", operationKey: "op-hold", command: "hold: external work" }, async r => { result = r; });
  const cancellation = await executor.cancel(execution.executionId, async r => { result = r; });
  assert.equal(cancellation.acknowledged, true);
  assert.equal(result.canceled, true);
  assert.equal(result.signal, "SIGTERM");
});

test("completed execution cannot claim cancellation acknowledgement", async () => {
  const executor = new DeterministicExecutor();
  const execution = await executor.start({ id: "task-done", operationKey: "op-done", command: "ok: done" });
  const cancellation = await executor.cancel(execution.executionId);
  assert.equal(cancellation.acknowledged, false);
  assert.equal(cancellation.reason, "already_finished");
});
