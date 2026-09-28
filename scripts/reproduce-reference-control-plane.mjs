import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ControlPlane, referenceFingerprint } from "../src/control-plane.mjs";
import { DeterministicExecutor } from "../src/executor.mjs";
import { StateStore } from "../src/store.mjs";

function run(args, { input, fail = false } = {}) {
  const result = spawnSync(process.execPath, ["bin/omnikali.mjs", ...args], {
    encoding: "utf8",
    input,
    cwd: process.cwd()
  });
  if (fail) {
    if (result.status === 0) throw new Error("expected failure: " + args.join(" "));
    return result;
  }
  if (result.status !== 0) throw new Error(args.join(" ") + " failed\n" + result.stderr + result.stdout);
  return result;
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const env = JSON.parse(await readFile("environments/local.json", "utf8"));
if (env.execution?.kind !== "deterministic") throw new Error("reference control plane reproduction requires the deterministic executor");

let status = JSON.parse(run(["status"]).stdout);
if (Object.keys(status.agents).length !== 1 || Object.values(status.agents)[0].name !== "reference-agent") {
  throw new Error("bootstrap did not register the reference agent");
}
if (Object.keys(status.resources).length !== 1 || Object.values(status.resources)[0].kind !== "workspace") {
  throw new Error("bootstrap did not declare the reference resource");
}
const eventsAfterBootstrap = status.events.length;

run(["agent", "reference-agent"]);
run(["resource", "workspace"]);
status = JSON.parse(run(["status"]).stdout);
if (Object.keys(status.agents).length !== 1 || Object.keys(status.resources).length !== 1) {
  throw new Error("idempotent registration duplicated control plane records");
}
if (status.events.length !== eventsAfterBootstrap) throw new Error("idempotent registration appended events");

run(["lock", "acquire", "reference-work", "reference-agent"]);
const busy = run(["lock", "acquire", "reference-work", "intruder"], { fail: true });
if (!/lock busy/.test(busy.stderr + busy.stdout)) throw new Error("exclusive lock did not reject a different owner");
run(["lock", "release", "reference-work", "reference-agent"]);

run(["task", "--operation", "repro-control-plane", "ok: control-plane-reproduced"]);
const eventsAfterTask = JSON.parse(run(["status"]).stdout).events.length;
run(["task", "--operation", "repro-control-plane", "ok: control-plane-reproduced"]);
status = JSON.parse(run(["status"]).stdout);
const tasks = Object.values(status.tasks);
if (tasks.length !== 1) throw new Error("duplicate operation key created a second task");
if (tasks[0].state !== "completed" || tasks[0].execution?.result?.code !== 0) throw new Error("reference task did not complete");
if (!String(tasks[0].execution?.result?.stdout).includes("control-plane-reproduced")) throw new Error("reference task output mismatch");
if (tasks[0].operationKey !== "repro-control-plane") throw new Error("operation key was not durable");
if (status.events.length !== eventsAfterTask) throw new Error("duplicate operation appended events");
if (Object.keys(status.locks).length !== 0) throw new Error("lock was not released");

const restarted = JSON.parse(run(["status"]).stdout);
if (Object.values(restarted.tasks)[0].state !== "completed") throw new Error("completed task did not survive process restart");

const before = referenceFingerprint(status);
const exported = run(["export"]).stdout;
const snapshot = JSON.parse(exported);
if (snapshot.format !== "omnikali-reference-snapshot" || snapshot.version !== 1) throw new Error("export is not a reference snapshot");

await rm(".state/omnikali.json");
run(["import"], { input: exported });
const imported = JSON.parse(run(["status"]).stdout);
if (!same(before, referenceFingerprint(imported))) throw new Error("import did not reconstruct the reference control plane");

run(["reconcile"]);
const reconciled = JSON.parse(run(["status"]).stdout);
if (Object.values(reconciled.tasks)[0].state !== "completed") throw new Error("reconcile changed a completed reference task");

const dir = await mkdtemp(join(tmpdir(), "grasshopper-control-plane-"));
try {
  const copy = new ControlPlane(new StateStore(join(dir, "state.json")), new DeterministicExecutor());
  await copy.importSnapshot(snapshot);
  await copy.store.update(state => {
    state.tasks.stale = { id: "stale", operationKey: "stale-op", state: "running", startedAt: new Date(Date.now() - 120000).toISOString() };
    state.locks.expired = { name: "expired", owner: "dead", state: "held", expiresAt: Date.now() - 1 };
  });
  await copy.reconcile(1000);
  const recovered = await copy.store.load();
  if (recovered.tasks.stale?.state !== "orphaned") throw new Error("stale running task was not orphaned");
  if (recovered.locks.expired) throw new Error("expired lock was not reclaimed");
  const completed = Object.values(recovered.tasks).find(task => task.operationKey === "repro-control-plane");
  if (completed?.state !== "completed") throw new Error("stale recovery changed the reconstructed completed task");
} finally {
  await rm(dir, { recursive: true, force: true });
}

const canonical = JSON.parse(run(["status"]).stdout);
if (!same(referenceFingerprint(reconciled), referenceFingerprint(canonical))) {
  throw new Error("stale-recovery proof mutated the reconstructed control plane");
}

console.log("reference_control_plane_lifecycle=agent,resource,lock,task,reconcile,export,import");
console.log("idempotent_reregistration=true");
console.log("exclusive_lock=true");
console.log("durable_task_restart=true");
console.log("snapshot_round_trip=true");
console.log("stale_recovery_on_snapshot_copy=true");
