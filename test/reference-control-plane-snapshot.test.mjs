import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ControlPlane, referenceFingerprint } from "../src/control-plane.mjs";
import { DeterministicExecutor } from "../src/executor.mjs";
import { StateStore } from "../src/store.mjs";

async function plane() {
  const dir = await mkdtemp(join(tmpdir(), "omnikali-snapshot-"));
  const cp = new ControlPlane(new StateStore(join(dir, "state.json")), new DeterministicExecutor());
  return { dir, cp };
}

test("export and import reconstruct the reference fingerprint", async () => {
  const source = await plane();
  const agent = await source.cp.registerAgent({ id: "agent_fixed", name: "reference-agent", environment: "local-reference" });
  const agentId = Object.values(agent.agents)[0].id;
  await source.cp.declareResource({ id: "res_fixed", agentId, kind: "workspace" });
  await source.cp.createTask({ id: "task_fixed", operationKey: "repro-control-plane", agentId, command: "ok: control-plane-reproduced", cwd: source.dir });
  const snapshot = await source.cp.exportSnapshot();
  const before = referenceFingerprint(await source.cp.store.load());

  const target = await plane();
  await target.cp.importSnapshot(snapshot);
  assert.deepEqual(referenceFingerprint(await target.cp.store.load()), before);
  await rm(source.dir, { recursive: true, force: true });
  await rm(target.dir, { recursive: true, force: true });
});

test("import fails closed on a non-empty plane, a bad snapshot, and private-key material", async () => {
  const { dir, cp } = await plane();
  await cp.registerAgent({ name: "reference-agent", environment: "local-reference" });
  const snapshot = await cp.exportSnapshot();
  await assert.rejects(() => cp.importSnapshot(snapshot), /non-empty/);
  await assert.rejects(() => cp.importSnapshot({ format: "other", version: 1, state: {} }), /invalid snapshot/);
  await assert.rejects(() => cp.importSnapshot({
    format: "omnikali-reference-snapshot",
    version: 1,
    state: { ...snapshot.state, note: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----" }
  }), /private-key/);
  await rm(dir, { recursive: true, force: true });
});

test("agentic control-plane verifier is fail-closed and does not claim production", async () => {
  const script = await readFile("scripts/verify-agentic-control-plane.sh", "utf8");
  assert.match(script, /git archive --format=tar/);
  assert.match(script, /working tree is dirty/);
  assert.match(script, /production_credentials_required=false/);
  assert.match(script, /live_production_mutation_performed=false/);
  assert.match(script, /production_readiness_claimed=false/);
  assert.match(script, /reproduce-reference-control-plane\.mjs/);
});
