import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  dryRun,
  liveRun,
  id,
  label
} from "../scripts/live-acceptance/scenarios/replacement_completion/scenario.mjs";
import {
  OwnerFenceSim,
  runFixture,
  TASK_STATES
} from "../scripts/live-acceptance/scenarios/replacement_completion/owner-fence-sim.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = path.join(ROOT, "scripts/live-acceptance/run-scenario.mjs");
const MANIFEST = path.join(ROOT, "reference/production/live-acceptance/manifest.json");
const SCENARIO_DIR = path.join(
  ROOT,
  "scripts/live-acceptance/scenarios/replacement_completion"
);

const SECRETISH = [
  /password\s*[:=]/i,
  /api[_-]?key\s*[:=]/i,
  /bearer\s+[a-z0-9]/i,
  /postgres(ql)?:\/\/[^\s]+/i,
  /[a-z0-9._-]+\.rds\.amazonaws\.com/i,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

test("scenario exports stable id and label", () => {
  assert.equal(id, "replacement_completion");
  assert.match(label, /Owner-fenced replacement completion/i);
});

test("owner-fence sim: replacement completes after reclaim", () => {
  const sim = new OwnerFenceSim({ nowMs: 1_000_000, leaseMs: 45_000 });
  sim.createTask("t1");
  sim.claimNext("worker-a", { taskId: "t1" });
  sim.advanceTime(50_000);
  const reclaimed = sim.reconcileExpired();
  assert.equal(reclaimed.length, 1);
  assert.equal(sim.getTask("t1").state, TASK_STATES.PENDING);
  sim.claimNext("worker-b", { taskId: "t1" });
  const done = sim.complete("t1", "worker-b", { ok: true });
  assert.equal(done.state, TASK_STATES.COMPLETED);
  assert.equal(done.owner_id, "worker-b");
});

test("owner-fence sim: stale owner cannot complete after replacement claim", () => {
  const sim = new OwnerFenceSim({ nowMs: 1_000_000, leaseMs: 45_000 });
  sim.createTask("t2");
  sim.claimNext("worker-a", { taskId: "t2" });
  sim.advanceTime(50_000);
  // claimNext on expired RUNNING also acts as replacement without explicit reconcile
  sim.claimNext("worker-b", { taskId: "t2" });
  assert.equal(sim.getTask("t2").owner_id, "worker-b");
  assert.throws(() => sim.complete("t2", "worker-a", { ok: true }), /owner mismatch/);
  assert.equal(sim.getTask("t2").state, TASK_STATES.RUNNING);
  sim.complete("t2", "worker-b", { ok: true });
  assert.equal(sim.getTask("t2").state, TASK_STATES.COMPLETED);
});

test("fixtures pass via runFixture", () => {
  for (const name of ["happy-path.json", "stale-owner-fenced.json"]) {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(SCENARIO_DIR, "fixtures", name), "utf8")
    );
    const result = runFixture(fixture);
    assert.equal(result.ok, true);
  }
});

test("dryRun passes fixtures without claiming COMPLETE", () => {
  const result = dryRun();
  assert.equal(result.ok, true);
  assert.match(result.evidence, /dry-run/i);
  assert.match(result.evidence, /not live COMPLETE/i);
  assert.equal(result.details.manifest_complete_claimed, false);
  assert.equal(result.details.production_mutated, false);
});

test("liveRun refuses record (fail-closed; no live evidence claim)", async () => {
  const result = await liveRun({
    evidence: "should not land",
    runAt: "2026-09-27T00:00:00Z",
    operator: "sc-replace",
    scenarioId: "replacement_completion"
  });
  assert.equal(result.ok, false);
  assert.match(result.evidence, /refused|fail-closed/i);
});

test("CLI dry-run exits 0 for replacement_completion and does not mutate manifest", () => {
  const before = fs.readFileSync(MANIFEST, "utf8");
  const result = spawnSync(
    process.execPath,
    [RUNNER, "--scenario", "replacement_completion", "--mode", "dry-run", "--json"],
    { cwd: ROOT, encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.manifest_mutated, false);
  assert.equal(fs.readFileSync(MANIFEST, "utf8"), before);
  const entry = JSON.parse(before).scenarios.replacement_completion;
  assert.equal(entry.status, "OPEN");
});

test("CLI record with flags still refuses and leaves manifest OPEN", async () => {
  const before = fs.readFileSync(MANIFEST, "utf8");
  const result = spawnSync(
    process.execPath,
    [
      RUNNER,
      "--scenario",
      "replacement_completion",
      "--mode",
      "record",
      "--evidence",
      "unauthorized invented evidence must not land",
      "--run-at",
      "2026-09-27T12:00:00Z",
      "--operator",
      "sc-replace-test",
      "--json"
    ],
    { cwd: ROOT, encoding: "utf8" }
  );
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.manifest_mutated, false);
  assert.equal(fs.readFileSync(MANIFEST, "utf8"), before);
  assert.equal(JSON.parse(before).scenarios.replacement_completion.status, "OPEN");
});

test("scenario artifacts have no secret-like patterns", () => {
  const files = [
    path.join(SCENARIO_DIR, "scenario.mjs"),
    path.join(SCENARIO_DIR, "owner-fence-sim.mjs"),
    path.join(SCENARIO_DIR, "fixtures/happy-path.json"),
    path.join(SCENARIO_DIR, "fixtures/stale-owner-fenced.json"),
    path.join(ROOT, "test/replacement-completion-scenario.test.mjs")
  ];
  for (const file of files) {
    const blob = fs.readFileSync(file, "utf8");
    for (const re of SECRETISH) {
      assert.doesNotMatch(blob, re, `${file} matched ${re}`);
    }
  }
});
