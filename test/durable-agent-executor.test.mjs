import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateStore } from "../src/store.mjs";
import { DurableAgentExecutor } from "../src/production/durable-agent-executor.mjs";
import { COMMAND_DISPOSITIONS } from "../src/executor-contract.mjs";

async function harness(adapter) {
  const dir = await mkdtemp(join(tmpdir(), "omnikali-executor-"));
  const store = new StateStore(join(dir, "state.json"));
  return { executor: new DurableAgentExecutor({ store, adapter }), dir };
}

test("operation identity is durably reserved before dispatch", async () => {
  let starts = 0;
  const { executor, dir } = await harness({
    async start() {
      starts++;
      return { code: 0, signal: null, stdout: "ok\n", stderr: "", completion: "confirmed" };
    }
  });

  try {
    const task = {
      id: "task-1",
      operationKey: "op-1",
      commandDisposition: COMMAND_DISPOSITIONS.IDEMPOTENT_MUTATION,
      command: "write"
    };
    const first = await executor.start(task);
    const duplicate = await executor.start({ ...task, id: "task-2" });

    assert.equal(starts, 1);
    assert.equal(first.executionId, duplicate.executionId);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.status, "confirmed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("adapter failure is indeterminate and is not retried by duplicate dispatch", async () => {
  let starts = 0;
  const { executor, dir } = await harness({
    async start() {
      starts++;
      throw new Error("connection lost after dispatch");
    }
  });

  try {
    const task = {
      id: "task-3",
      operationKey: "op-3",
      commandDisposition: COMMAND_DISPOSITIONS.NON_IDEMPOTENT_MUTATION,
      command: "charge"
    };
    const first = await executor.start(task);
    const duplicate = await executor.start(task);

    assert.equal(first.status, "indeterminate");
    assert.equal(first.result.completion, "indeterminate");
    assert.equal(duplicate.duplicate, true);
    assert.equal(starts, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unsupported cancellation is never reported as acknowledged", async () => {
  const { executor, dir } = await harness({
    async start() {
      return { code: 0, signal: null, stdout: "ok\n", stderr: "", completion: "confirmed" };
    }
  });

  try {
    const execution = await executor.start({
      id: "task-4",
      operationKey: "op-4",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE,
      command: "shell"
    });
    const result = await executor.cancel(execution.executionId);
    assert.equal(result.acknowledged, false);
    assert.equal(result.reason, "already_finished");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("live cancellation capability is required for cancellation acknowledgement", async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { executor, dir } = await harness({
    start() { return pending; }
  });

  try {
    const startPromise = executor.start({
      id: "task-5",
      operationKey: "op-5",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE,
      command: "shell"
    });
    await new Promise(resolve => setTimeout(resolve, 10));

    const state = await executor.store.load();
    const executionId = state.executions["op-5"].executionId;
    const cancellation = await executor.cancel(executionId);
    assert.equal(cancellation.acknowledged, false);
    assert.equal(cancellation.reason, "executor_cancellation_unsupported");

    release({ code: 0, signal: null, stdout: "", stderr: "", completion: "confirmed" });
    await startPromise;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("duplicate while first dispatch is still in flight is not dispatched twice", async () => {
  let starts = 0;
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const { executor, dir } = await harness({
    start() {
      starts++;
      return pending;
    }
  });

  try {
    const task = {
      id: "task-6",
      operationKey: "op-6",
      commandDisposition: COMMAND_DISPOSITIONS.IDEMPOTENT_MUTATION,
      command: "update"
    };
    const firstPromise = executor.start(task);
    await new Promise(resolve => setTimeout(resolve, 10));
    const duplicate = await executor.start({ ...task, id: "task-7" });

    assert.equal(starts, 1);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.result.completion, "indeterminate");

    release({ code: 0, signal: null, stdout: "ok\n", stderr: "", completion: "confirmed" });
    const first = await firstPromise;
    assert.equal(first.status, "confirmed");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
