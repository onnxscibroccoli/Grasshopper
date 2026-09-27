import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_SCENARIO_IDS } from "../scripts/live-acceptance/scenario-ids.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUNNER = path.join(ROOT, "scripts/live-acceptance/run-scenario.mjs");
const MANIFEST = path.join(ROOT, "reference/production/live-acceptance/manifest.json");
const SCENARIOS_DIR = path.join(ROOT, "scripts/live-acceptance/scenarios");
const README = path.join(ROOT, "scripts/live-acceptance/README.md");
const DOCS = path.join(ROOT, "docs/LIVE_ACCEPTANCE.md");

const SECRETISH = [
  /password\s*[:=]/i,
  /api[_-]?key\s*[:=]/i,
  /bearer\s+[a-z0-9]/i,
  /postgres(ql)?:\/\/[^\s]+/i,
  /[a-z0-9._-]+\.rds\.amazonaws\.com/i,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];

function runRunner(args = []) {
  return spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: ROOT,
    encoding: "utf8"
  });
}

function readManifest() {
  return fs.readFileSync(MANIFEST, "utf8");
}

test("runner scaffold files and package script exist", () => {
  assert.equal(fs.existsSync(RUNNER), true);
  assert.equal(fs.existsSync(path.join(ROOT, "scripts/live-acceptance/scenario-ids.mjs")), true);
  assert.equal(fs.existsSync(README), true);
  assert.equal(fs.existsSync(path.join(SCENARIOS_DIR, "_template/scenario.mjs")), true);
  for (const id of REQUIRED_SCENARIO_IDS) {
    assert.equal(
      fs.existsSync(path.join(SCENARIOS_DIR, id, "scenario.mjs")),
      true,
      `missing stub for ${id}`
    );
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts["live-acceptance:run"],
    "node scripts/live-acceptance/run-scenario.mjs"
  );
});

test("scenario-ids match the eight required live-acceptance ids", () => {
  assert.deepEqual(REQUIRED_SCENARIO_IDS, [
    "normal_exec",
    "worker_termination",
    "stale_lease_reclaim",
    "replacement_completion",
    "duplicate_fencing",
    "gateway_restart",
    "db_failure",
    "network_interrupt"
  ]);
});

test("unknown scenario id fails with exit 1", () => {
  const result = runRunner(["--scenario", "not_a_real_scenario", "--json"]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.match(payload.error, /unknown scenario id/i);
  assert.equal(payload.manifest_mutated, false);
});

test("stub dry-run returns not ok and exits 1", () => {
  const result = runRunner(["--scenario", "normal_exec", "--mode", "dry-run", "--json"]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.mode, "dry-run");
  assert.equal(payload.scenarioId, "normal_exec");
  assert.match(String(payload.evidence), /scaffold stub|not implemented/i);
  assert.equal(payload.manifest_mutated, false);
});

test("dry-run default mode does not mutate the evidence manifest", () => {
  const before = readManifest();
  const result = runRunner(["--scenario", "db_failure", "--json"]);
  assert.equal(result.status, 1);
  const after = readManifest();
  assert.equal(after, before, "manifest must be unchanged after dry-run");
  const manifest = JSON.parse(after);
  for (const id of REQUIRED_SCENARIO_IDS) {
    assert.equal(manifest.scenarios[id].status, "OPEN");
  }
});

test("record without required flags fails closed and does not mutate manifest", () => {
  const before = readManifest();
  const cases = [
    ["--scenario", "normal_exec", "--mode", "record", "--json"],
    [
      "--scenario",
      "normal_exec",
      "--mode",
      "record",
      "--evidence",
      "partial only",
      "--json"
    ],
    [
      "--scenario",
      "normal_exec",
      "--mode",
      "record",
      "--evidence",
      "partial",
      "--run-at",
      "2026-09-27T18:00:00Z",
      "--json"
    ]
  ];
  for (const args of cases) {
    const result = runRunner(args);
    assert.equal(result.status, 1, `expected fail for ${args.join(" ")}\n${result.stdout}`);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /missing required flags|record refused/i);
    assert.equal(payload.manifest_mutated, false);
  }
  assert.equal(readManifest(), before);
});

test("record with flags still fails closed on stub liveRun (no COMPLETE)", () => {
  const before = readManifest();
  const result = runRunner([
    "--scenario",
    "gateway_restart",
    "--mode",
    "record",
    "--evidence",
    "authorized isolated restore scaffold check 2026-09-27; stub only",
    "--run-at",
    "2026-09-27T18:00:00Z",
    "--operator",
    "acceptance-dept",
    "--json"
  ]);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.manifest_mutated, false);
  assert.match(String(payload.evidence), /stub|not implemented|refuse/i);
  assert.equal(readManifest(), before);
  const manifest = JSON.parse(readManifest());
  assert.equal(manifest.scenarios.gateway_restart.status, "OPEN");
});

test("all eight stub dryRuns fail closed", () => {
  for (const id of REQUIRED_SCENARIO_IDS) {
    const result = runRunner(["--scenario", id, "--json"]);
    assert.equal(result.status, 1, `expected exit 1 for ${id}`);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.ok, false);
    assert.equal(payload.manifest_mutated, false);
  }
});

test("docs mention runner scaffold; stubs are not evidence", () => {
  const doc = fs.readFileSync(DOCS, "utf8");
  assert.match(doc, /live-acceptance:run|run-scenario\.mjs/);
  assert.match(doc, /scaffold/i);
  assert.match(doc, /not evidence|remain OPEN|stay OPEN/i);
  const readme = fs.readFileSync(README, "utf8");
  assert.match(readme, /fail-closed/i);
  assert.match(readme, /dry-run/);
  assert.match(readme, /Never.*COMPLETE|never writes COMPLETE/i);
});

test("runner scaffold sources have no secret-like patterns", () => {
  const files = [
    RUNNER,
    path.join(ROOT, "scripts/live-acceptance/scenario-ids.mjs"),
    README,
    path.join(SCENARIOS_DIR, "_template/scenario.mjs"),
    ...REQUIRED_SCENARIO_IDS.map((id) =>
      path.join(SCENARIOS_DIR, id, "scenario.mjs")
    ),
    path.join(ROOT, "test/live-acceptance-runner.test.mjs")
  ];
  const blobs = files.map((f) => fs.readFileSync(f, "utf8"));
  blobs.push(runRunner(["--scenario", "normal_exec", "--json"]).stdout);
  blobs.push(
    runRunner([
      "--scenario",
      "not_a_real_scenario",
      "--json"
    ]).stdout
  );
  for (const blob of blobs) {
    for (const re of SECRETISH) {
      assert.doesNotMatch(blob, re, `secret-like pattern ${re} found`);
    }
  }
});
