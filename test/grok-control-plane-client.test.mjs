import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateStore } from "../src/store.mjs";
import { ControlPlane } from "../src/control-plane.mjs";
import { DeterministicExecutor } from "../src/executor.mjs";
import { COMMAND_DISPOSITIONS } from "../src/executor-contract.mjs";
import { GrokControlPlaneClient } from "../src/clients/grok-control-plane-client.mjs";

const PROOF = "presented-proof-must-not-be-persisted";
const REF = "secret-manager:omnikali/grok-client";

function authenticator(principals) {
  return async ({ credentialRef, presentedProof }) => {
    const principalId = principals.get(presentedProof);
    if (!principalId || credentialRef !== REF) return null;
    return { principalId };
  };
}

async function harness() {
  const dir = await mkdtemp(join(tmpdir(), "omnikali-grok-"));
  const store = new StateStore(join(dir, "state.json"));
  const executor = new DeterministicExecutor();
  let starts = 0;
  const start = executor.start.bind(executor);
  executor.start = async (...args) => {
    starts++;
    return start(...args);
  };
  const controlPlane = new ControlPlane(store, executor);
  const client = new GrokControlPlaneClient({
    controlPlane,
    authenticate: authenticator(new Map([[PROOF, "alice"]]))
  });
  return { dir, store, client, starts: () => starts };
}

function request(overrides = {}) {
  return {
    credentialRef: REF,
    presentedProof: PROOF,
    grokSessionId: "session-1",
    clientOperationId: "turn-1",
    command: "ok: inspect",
    commandDisposition: COMMAND_DISPOSITIONS.READ_ONLY,
    environment: "local",
    cwd: "/workspace",
    ...overrides
  };
}

test("grok client rejects an executor dependency", () => {
  assert.throws(
    () => new GrokControlPlaneClient({ controlPlane: {}, authenticate() {}, executor: {} }),
    /cannot accept an executor/
  );
});

test("unauthenticated grok submit does not create a task or persist the proof", async () => {
  const { dir, store, client } = await harness();
  try {
    const denied = await client.submit(request({ presentedProof: "nope" }));
    const state = await store.load();
    assert.equal(denied.accepted, false);
    assert.equal(denied.reason, "unauthenticated");
    assert.equal(Object.keys(state.tasks).length, 0);
    assert.equal(JSON.stringify(state).includes(PROOF), false);
    assert.equal(JSON.stringify(state).includes("nope"), false);
    assert.equal(state.events.some(event => event.type === "grok.operation.denied"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("authenticated submit maps one grok operation onto one durable task", async () => {
  const { dir, store, client, starts } = await harness();
  try {
    const first = await client.submit(request());
    const retry = await client.submit(request());
    const state = await store.load();
    const tasks = Object.values(state.tasks);

    assert.equal(first.accepted, true);
    assert.equal(first.duplicate, false);
    assert.equal(first.guarantee, "control-plane-ownership-only");
    assert.equal(retry.duplicate, true);
    assert.equal(retry.task.id, first.task.id);
    assert.equal(tasks.length, 1);
    assert.equal(starts(), 1);
    assert.equal(tasks[0].state, "completed");
    assert.equal(tasks[0].origin.kind, "grok");
    assert.equal(tasks[0].origin.principalId, "alice");
    assert.equal(tasks[0].origin.credentialRef, REF);
    assert.equal(tasks[0].commandDisposition, COMMAND_DISPOSITIONS.READ_ONLY);
    assert.equal(tasks[0].operationKey, "grok:alice:session-1:turn-1");
    assert.equal(JSON.stringify(state).includes(PROOF), false);
    assert.equal(state.events.some(event => event.type === "grok.operation.accepted" && event.data.duplicate === false), true);
    assert.equal(state.events.some(event => event.type === "grok.operation.accepted" && event.data.duplicate === true), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a different grok session does not reuse the durable task", async () => {
  const { dir, store, client } = await harness();
  try {
    const first = await client.submit(request());
    const second = await client.submit(request({ grokSessionId: "session-2", clientOperationId: "turn-9" }));
    assert.notEqual(first.task.id, second.task.id);
    assert.equal(Object.keys((await store.load()).tasks).length, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cancellation is requested through the control plane and audited", async () => {
  const { dir, store, client } = await harness();
  try {
    const submitted = await client.submit(request({
      command: "hold: external work",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE
    }));
    assert.equal(submitted.task.state, "running");
    const cancellation = await client.cancel(request({
      command: "hold: external work",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE
    }));
    const state = await store.load();
    assert.equal(cancellation.accepted, true);
    assert.equal(cancellation.acknowledged, true);
    assert.equal(state.tasks[submitted.task.id].state, "stopped");
    assert.equal(state.events.some(event => event.type === "grok.cancel.requested" && event.data.acknowledged === true), true);
    assert.equal(JSON.stringify(state).includes(PROOF), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("another principal cannot cancel or observe a grok operation", async () => {
  const { dir, store, client } = await harness();
  const other = new GrokControlPlaneClient({
    controlPlane: client.controlPlane,
    authenticate: authenticator(new Map([["bob-proof", "bob"]]))
  });
  try {
    const submitted = await client.submit(request({ command: "hold: external work", commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE }));
    const forbidden = await other.cancel(request({
      presentedProof: "bob-proof",
      command: "hold: external work",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE
    }));
    assert.equal(forbidden.accepted, false);
    assert.equal(forbidden.acknowledged, false);
    assert.equal(forbidden.reason, "unknown_operation");
    assert.equal((await store.load()).tasks[submitted.task.id].state, "running");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("a planted operation key with a different origin is not exposed or reused", async () => {
  const { dir, store, client, starts } = await harness();
  try {
    await store.update(s => {
      s.tasks.planted = {
        id: "planted",
        operationKey: "grok:alice:session-1:turn-1",
        command: "ok: not-grok",
        state: "completed",
        origin: { kind: "other", principalId: "mallory" }
      };
    });
    const result = await client.submit(request());
    const state = await store.load();
    assert.equal(result.accepted, false);
    assert.equal(result.reason, "operation_forbidden");
    assert.equal(result.task, undefined);
    assert.equal(starts(), 0);
    assert.equal(Object.keys(state.tasks).length, 1);
    assert.equal(state.tasks.planted.state, "completed");
    assert.equal(JSON.stringify(result).includes("not-grok"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("grok client source does not select a database provider", async () => {
  const source = await readFile(new URL("../src/clients/grok-control-plane-client.mjs", import.meta.url), "utf8");
  assert.equal(/neon|postgres:\/\/|DATABASE_URL/i.test(source), false);
  assert.equal(source.includes(".executor"), false);
});
