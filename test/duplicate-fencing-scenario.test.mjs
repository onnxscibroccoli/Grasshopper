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
} from "../scripts/live-acceptance/scenarios/duplicate_fencing/scenario.mjs";
import {
  OwnerFenceSim,
  runFixture,
  TASK_STATES
} from "../scripts/live-acceptance/scenarios/duplicate_fencing/owner-fence-sim.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = path.join(ROOT, "scripts/live-acceptance/run-scenario.mjs");
const MANIFEST = path.join(ROOT, "reference/production/live-acceptance/manifest.json");
const SCENARIO_DIR = path.join(
  ROOT,
  "scripts/live-acceptance/scenarios/duplicate_fencing"
);

const FIXTURE_NAMES = [
  "current-owner-completes.json",
  "stale-owner-fenced.json",
  "duplicate-claim-while-leased.json",
  "stale-owner-fail-fenced.json"
];

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
  assert.equal(id, "duplicate_fencing");
  assert.match(label, /Duplicate\/stale owner identity is fenced/i);
});

test("owner-fence sim: current owner completes while leased", () => {
  const sim = new OwnerFenceSim({ nowMs: 1_000_000, leaseMs: 45_000 });
  sim.createTask("t1");
  sim.claimNext("worker-a", { taskId: "t1" });
  const done = sim.complete("t1", "worker-a", { ok: true });
  assert.equal(done.state, TASK_STATES.COMPLETED);
  assert.equal(done.owner_id, "worker-a");
});

test("owner-fence sim: stale owner cannot complete while lease valid", () => {
  const sim = new OwnerFenceSim({ nowMs: 1_000_000, leaseMs: 45_000 });
  sim.createTask("t2");
  sim.claimNext("worker-a", { taskId: "t2" });
  assert.throws(() => sim.complete("t2", "worker-stale", { ok: true }), /owner mismatch/);
  assert.equal(sim.getTask("t2").state, TASK_STATES.RUNNING);
  assert.equal(sim.getTask("t2").owner_id, "worker-a");
});

test("owner-fence sim: duplicate claim while leased does not steal ownership", () => {
  const sim = new OwnerFenceSim({ nowMs: 1_000_000, leaseMs: 45_000 });
  sim.createTask("t3");
  sim.claimNext("worker-a", { taskId: "t3" });
  const second = sim.claimNext("worker-b", { taskId: "t3" });
  assert.equal(second, null);
  assert.equal(sim.getTask("t3").owner_id, "worker-a");
  sim.complete("t3", "worker-a", { ok: true });
  assert.equal(sim.getTask("t3").state, TASK_STATES.COMPLETED);
});

test("owner-fence sim: stale owner cannot fail while lease valid", () => {
  const sim = new OwnerFenceSim({ nowMs: 1_000_000, leaseMs: 45_000 });
  sim.createTask("t4");
  sim.claimNext("worker-a", { taskId: "t4" });
  assert.throws(
    () => sim.fail("t4", "worker-stale", { message: "spoof" }),
    /owner mismatch/
  );
  assert.equal(sim.getTask("t4").state, TASK_STATES.RUNNING);
});

test("fixtures pass via runFixture", () => {
  for (const name of FIXTURE_NAMES) {
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

test("liveRun refuses record (fail-closed)", async () => {
  const result = await liveRun({
    evidence: "should not land",
    runAt: "2026-09-27T00:00:00Z",
    operator: "scenario-fencing",
    scenarioId: "duplicate_fencing"
  });
  assert.equal(result.ok, false);
  assert.match(result.evidence, /refused|fail-closed/i);
});

test("CLI dry-run exits 0 for duplicate_fencing and does not mutate manifest", () => {
  const before = fs.readFileSync(MANIFEST, "utf8");
  const result = spawnSync(
    process.execPath,
    [RUNNER, "--scenario", "duplicate_fencing", "--mode", "dry-run", "--json"],
    { cwd: ROOT, encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.manifest_mutated, false);
  assert.equal(fs.readFileSync(MANIFEST, "utf8"), before);
  const entry = JSON.parse(before).scenarios.duplicate_fencing;
  assert.equal(entry.status, "OPEN");
});

test("CLI record with flags still refuses and leaves manifest OPEN", () => {
  const before = fs.readFileSync(MANIFEST, "utf8");
  const result = spawnSync(
    process.execPath,
    [
      RUNNER,
      "--scenario",
      "duplicate_fencing",
      "--mode",
      "record",
      "--evidence",
      "unauthorized invented evidence must not land",
      "--run-at",
      "2026-09-27T12:00:00Z",
      "--operator",
      "scenario-fencing-test",
      "--json"
    ],
    { cwd: ROOT, encoding: "utf8" }
  );
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.manifest_mutated, false);
  assert.equal(fs.readFileSync(MANIFEST, "utf8"), before);
  assert.equal(JSON.parse(before).scenarios.duplicate_fencing.status, "OPEN");
});

test("scenario artifacts have no secret-like patterns", () => {
  const files = [
    path.join(SCENARIO_DIR, "scenario.mjs"),
    path.join(SCENARIO_DIR, "owner-fence-sim.mjs"),
    ...FIXTURE_NAMES.map((n) => path.join(SCENARIO_DIR, "fixtures", n)),
    path.join(ROOT, "test/duplicate-fencing-scenario.test.mjs")
  ];
  for (const file of files) {
    const blob = fs.readFileSync(file, "utf8");
    for (const re of SECRETISH) {
      assert.doesNotMatch(blob, re, `${file} matched ${re}`);
    }
  }
});
