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

test("cancel after confirmed reports already_finished and is not acknowledged", async () => {
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

test("unsupported cancel while in-flight records request without acknowledgement", async () => {
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

    const afterCancel = await executor.store.load();
    assert.equal(afterCancel.executions["op-5"].cancellation.requested, true);
    assert.equal(afterCancel.executions["op-5"].cancellation.acknowledged, false);
    assert.notEqual(afterCancel.executions["op-5"].status, "cancelled");

    release({ code: 0, signal: null, stdout: "", stderr: "", completion: "confirmed" });
    await startPromise;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("acknowledged cancellation remains recorded after adapter completion", async () => {
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const dispatched = new Promise(resolve => { started = resolve; });
  const { executor, dir } = await harness({
    start() { started(); return pending; },
    async cancel() { return { acknowledged: true }; }
  });

  try {
    const startPromise = executor.start({
      id: "task-cancel",
      operationKey: "op-cancel",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE,
      command: "shell"
    });
    await dispatched;
    const executionId = (await executor.store.load()).executions["op-cancel"].executionId;
    assert.equal((await executor.cancel(executionId)).acknowledged, true);

    release({ code: null, signal: "SIGTERM", stdout: "", stderr: "", canceled: true, completion: "cancelled" });
    const completed = await startPromise;
    assert.equal(completed.status, "cancelled");
    assert.equal(completed.cancellation.requested, true);
    assert.equal(completed.cancellation.acknowledged, true);
    assert.ok(completed.cancellation.acknowledgedAt);

    const recorded = (await executor.store.load()).executions["op-cancel"];
    assert.deepEqual(recorded.cancellation, completed.cancellation);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("acknowledged cancellation plus confirmed adapter result becomes indeterminate", async () => {
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const dispatched = new Promise(resolve => { started = resolve; });
  const { executor, dir } = await harness({
    start() { started(); return pending; },
    async cancel() { return { acknowledged: true }; }
  });

  try {
    const startPromise = executor.start({
      id: "task-cancel-confirmed-conflict",
      operationKey: "op-cancel-confirmed-conflict",
      commandDisposition: COMMAND_DISPOSITIONS.NON_IDEMPOTENT_MUTATION,
      command: "charge"
    });
    await dispatched;

    const executionId = (await executor.store.load()).executions["op-cancel-confirmed-conflict"].executionId;
    assert.equal((await executor.cancel(executionId)).acknowledged, true);

    release({
      code: 0,
      signal: null,
      stdout: "",
      stderr: "",
      completion: "confirmed"
    });

    const completed = await startPromise;
    assert.equal(completed.status, "indeterminate");
    assert.equal(completed.result.completion, "indeterminate");
    assert.equal(completed.result.reconciliation.source, "cancellation_acknowledged_after_dispatch");
    assert.equal(completed.cancellation.acknowledged, true);

    const duplicate = await executor.start({
      id: "task-cancel-confirmed-conflict-duplicate",
      operationKey: "op-cancel-confirmed-conflict",
      commandDisposition: COMMAND_DISPOSITIONS.NON_IDEMPOTENT_MUTATION,
      command: "charge"
    });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.status, "indeterminate");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("acknowledged cancellation remains recorded after adapter failure", async () => {
  let fail;
  let started;
  const pending = new Promise((resolve, reject) => { fail = reject; });
  const dispatched = new Promise(resolve => { started = resolve; });
  const { executor, dir } = await harness({
    start() { started(); return pending; },
    async cancel() { return { acknowledged: true }; }
  });

  try {
    const startPromise = executor.start({
      id: "task-cancel-failure",
      operationKey: "op-cancel-failure",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE,
      command: "shell"
    });
    await dispatched;
    const executionId = (await executor.store.load()).executions["op-cancel-failure"].executionId;
    assert.equal((await executor.cancel(executionId)).acknowledged, true);

    fail(new Error("adapter connection lost"));
    const completed = await startPromise;
    assert.equal(completed.status, "indeterminate");
    assert.equal(completed.cancellation.acknowledged, true);
    assert.equal((await executor.store.load()).executions["op-cancel-failure"].cancellation.acknowledged, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("duplicate while first dispatch is still in flight is not dispatched twice", async () => {
  let starts = 0;
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const dispatched = new Promise(resolve => { started = resolve; });
  const { executor, dir } = await harness({
    start() {
      starts++;
      started();
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
    await dispatched;
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

test("cancel unknown execution is not acknowledged", async () => {
  const { executor, dir } = await harness({
    async start() {
      return { code: 0, signal: null, stdout: "ok\n", stderr: "", completion: "confirmed" };
    }
  });

  try {
    const cancellation = await executor.cancel("missing-exec-id");
    assert.equal(cancellation.acknowledged, false);
    assert.equal(cancellation.reason, "unknown_execution");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("adapter cancel not-acknowledged does not flip store to cancelled", async () => {
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const dispatched = new Promise(resolve => { started = resolve; });
  const { executor, dir } = await harness({
    start() { started(); return pending; },
    async cancel() { return { acknowledged: false, reason: "bridge_refused" }; }
  });

  try {
    const startPromise = executor.start({
      id: "task-not-ack",
      operationKey: "op-not-ack",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE,
      command: "shell"
    });
    await dispatched;
    const before = (await executor.store.load()).executions["op-not-ack"];
    const cancellation = await executor.cancel(before.executionId);

    assert.equal(cancellation.acknowledged, false);
    assert.equal(cancellation.reason, "bridge_refused");

    const after = (await executor.store.load()).executions["op-not-ack"];
    assert.notEqual(after.status, "cancelled");
    assert.equal(after.cancellation.acknowledged, false);

    release({ code: 0, signal: null, stdout: "ok\n", stderr: "", completion: "confirmed" });
    await startPromise;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("adapter cancel omitted reason reports not_acknowledged without store cancel flip", async () => {
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const dispatched = new Promise(resolve => { started = resolve; });
  const { executor, dir } = await harness({
    start() { started(); return pending; },
    async cancel() { return { acknowledged: false }; }
  });

  try {
    const startPromise = executor.start({
      id: "task-not-ack-default",
      operationKey: "op-not-ack-default",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE,
      command: "shell"
    });
    await dispatched;
    const executionId = (await executor.store.load()).executions["op-not-ack-default"].executionId;
    const cancellation = await executor.cancel(executionId);

    assert.equal(cancellation.acknowledged, false);
    assert.equal(cancellation.reason, "not_acknowledged");

    const after = (await executor.store.load()).executions["op-not-ack-default"];
    assert.notEqual(after.status, "cancelled");
    assert.equal(after.cancellation.acknowledged, false);

    release({ code: 0, signal: null, stdout: "ok\n", stderr: "", completion: "confirmed" });
    await startPromise;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("duplicate start after cancel-ack does not re-dispatch", async () => {
  let starts = 0;
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const dispatched = new Promise(resolve => { started = resolve; });
  const { executor, dir } = await harness({
    start() {
      starts++;
      started();
      return pending;
    },
    async cancel() { return { acknowledged: true }; }
  });

  try {
    const task = {
      id: "task-dup-cancel",
      operationKey: "op-dup-cancel",
      commandDisposition: COMMAND_DISPOSITIONS.IDEMPOTENT_MUTATION,
      command: "write"
    };
    const startPromise = executor.start(task);
    await dispatched;
    const executionId = (await executor.store.load()).executions["op-dup-cancel"].executionId;
    assert.equal((await executor.cancel(executionId)).acknowledged, true);

    const recorded = (await executor.store.load()).executions["op-dup-cancel"];
    assert.equal(recorded.status, "cancelled");

    const duplicate = await executor.start({ ...task, id: "task-dup-cancel-2" });
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.status, "cancelled");
    assert.equal(starts, 1);

    release({ code: null, signal: "SIGTERM", stdout: "", stderr: "", canceled: true, completion: "cancelled" });
    await startPromise;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cancel already-cancelled reports already_finished", async () => {
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const dispatched = new Promise(resolve => { started = resolve; });
  const { executor, dir } = await harness({
    start() { started(); return pending; },
    async cancel() { return { acknowledged: true }; }
  });

  try {
    const startPromise = executor.start({
      id: "task-already-cancel",
      operationKey: "op-already-cancel",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE,
      command: "shell"
    });
    await dispatched;
    const executionId = (await executor.store.load()).executions["op-already-cancel"].executionId;
    assert.equal((await executor.cancel(executionId)).acknowledged, true);
    assert.equal((await executor.store.load()).executions["op-already-cancel"].status, "cancelled");

    const second = await executor.cancel(executionId);
    assert.equal(second.acknowledged, false);
    assert.equal(second.reason, "already_finished");

    release({ code: null, signal: "SIGTERM", stdout: "", stderr: "", canceled: true, completion: "cancelled" });
    await startPromise;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("start-only adapter shape yields executor_cancellation_unsupported while in-flight", async () => {
  let release;
  let started;
  const pending = new Promise(resolve => { release = resolve; });
  const dispatched = new Promise(resolve => { started = resolve; });
  // Mirrors production createAgentExecutor shape: start-only function object with no cancel.
  const adapter = {
    start: async () => {
      started();
      return pending;
    }
  };
  const { executor, dir } = await harness(adapter);

  try {
    const startPromise = executor.start({
      id: "task-start-only",
      operationKey: "op-start-only",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE,
      command: "shell"
    });
    await dispatched;
    const executionId = (await executor.store.load()).executions["op-start-only"].executionId;
    const cancellation = await executor.cancel(executionId);
    assert.equal(cancellation.acknowledged, false);
    assert.equal(cancellation.reason, "executor_cancellation_unsupported");
    assert.equal((await executor.store.load()).executions["op-start-only"].cancellation.requested, true);
    assert.equal((await executor.store.load()).executions["op-start-only"].cancellation.acknowledged, false);

    release({ code: 0, signal: null, stdout: "", stderr: "", completion: "confirmed" });
    await startPromise;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
