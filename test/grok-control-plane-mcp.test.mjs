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
import {
  GROK_CONTROL_PLANE_TOOL_NAMES,
  callGrokControlPlaneTool,
  createGrokControlPlaneToolHandlers,
  listGrokControlPlaneTools
} from "../src/mcp/grok-control-plane-tools.mjs";

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
  const dir = await mkdtemp(join(tmpdir(), "omnikali-grok-mcp-"));
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
  const handlers = createGrokControlPlaneToolHandlers({ client });
  return { dir, store, client, handlers, starts: () => starts };
}

function submitArgs(overrides = {}) {
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

test("createGrokControlPlaneToolHandlers rejects executor or adapter option", () => {
  const client = { submit() {}, cancel() {} };
  assert.throws(
    () => createGrokControlPlaneToolHandlers({ client, executor: {} }),
    /cannot accept an executor/
  );
  assert.throws(
    () => createGrokControlPlaneToolHandlers({ client, adapter: {} }),
    /cannot accept an executor/
  );
});

test("listGrokControlPlaneTools exposes exactly submit and cancel", () => {
  assert.deepEqual([...GROK_CONTROL_PLANE_TOOL_NAMES], [
    "omnikali_submit_operation",
    "omnikali_cancel_operation"
  ]);
  const tools = listGrokControlPlaneTools();
  assert.equal(tools.length, 2);
  assert.equal(tools[0].name, "omnikali_submit_operation");
  assert.equal(tools[1].name, "omnikali_cancel_operation");
  assert.equal(tools[0].inputSchema.required.includes("commandDisposition"), true);
  assert.equal(tools[0].inputSchema.required.includes("command"), true);
  assert.equal(tools[0].inputSchema.required.includes("credentialRef"), true);
});

test("submit tool creates a durable task via the client", async () => {
  const { dir, store, handlers, starts } = await harness();
  try {
    const first = await callGrokControlPlaneTool(handlers, "omnikali_submit_operation", submitArgs());
    const retry = await callGrokControlPlaneTool(handlers, "omnikali_submit_operation", submitArgs());
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
    assert.equal(tasks[0].commandDisposition, COMMAND_DISPOSITIONS.READ_ONLY);
    assert.equal(tasks[0].operationKey, "grok:alice:session-1:turn-1");
    assert.equal(JSON.stringify(state).includes(PROOF), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("cancel tool acknowledges through the control plane", async () => {
  const { dir, store, handlers } = await harness();
  try {
    const submitted = await callGrokControlPlaneTool(handlers, "omnikali_submit_operation", submitArgs({
      command: "hold: external work",
      commandDisposition: COMMAND_DISPOSITIONS.INTERACTIVE
    }));
    assert.equal(submitted.task.state, "running");
    const cancellation = await callGrokControlPlaneTool(handlers, "omnikali_cancel_operation", {
      credentialRef: REF,
      presentedProof: PROOF,
      grokSessionId: "session-1",
      clientOperationId: "turn-1"
    });
    const state = await store.load();
    assert.equal(cancellation.accepted, true);
    assert.equal(cancellation.acknowledged, true);
    assert.equal(state.tasks[submitted.task.id].state, "stopped");
    assert.equal(state.events.some(event => event.type === "grok.cancel.requested" && event.data.acknowledged === true), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("unknown tool name is denied without an executor path", async () => {
  const { dir, handlers } = await harness();
  try {
    const denied = await callGrokControlPlaneTool(handlers, "omnikali_run_executor", submitArgs());
    assert.equal(denied.accepted, false);
    assert.equal(denied.reason, "unknown_tool");
    assert.equal(denied.task, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("mcp module source has no neon/DATABASE_URL/postgres and does not import executor or production", async () => {
  const source = await readFile(new URL("../src/mcp/grok-control-plane-tools.mjs", import.meta.url), "utf8");
  assert.equal(/neon|DATABASE_URL|postgres:\/\//i.test(source), false);
  assert.equal(/from\s+["'].*executor\.mjs["']/.test(source), false);
  assert.equal(/from\s+["'].*production\//.test(source), false);
  assert.equal(source.includes("DeterministicExecutor"), false);
});
