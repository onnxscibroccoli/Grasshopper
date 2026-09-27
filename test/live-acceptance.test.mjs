import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts/verify-live-acceptance.mjs");
const MANIFEST = path.join(ROOT, "reference/production/live-acceptance/manifest.json");
const DOCS = path.join(ROOT, "docs/LIVE_ACCEPTANCE.md");

const REQUIRED_IDS = [
  "normal_exec",
  "worker_termination",
  "stale_lease_reclaim",
  "replacement_completion",
  "duplicate_fencing",
  "gateway_restart",
  "db_failure",
  "network_interrupt"
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

function runHarness(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8"
  });
}

test("live acceptance harness script and docs exist", () => {
  assert.equal(fs.existsSync(SCRIPT), true);
  assert.equal(fs.existsSync(MANIFEST), true);
  assert.equal(fs.existsSync(DOCS), true);
  const source = fs.readFileSync(SCRIPT, "utf8");
  assert.match(source, /fail-closed/);
  assert.match(source, /live-acceptance/);
  assert.match(source, /does not itself run against production/i);
});

test("package.json exposes verify:live-acceptance", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["verify:live-acceptance"], "node scripts/verify-live-acceptance.mjs");
});

test("manifest lists all eight scenarios as OPEN starter evidence", () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.name, "live-acceptance");
  for (const id of REQUIRED_IDS) {
    const entry = manifest.scenarios[id];
    assert.ok(entry, `missing scenario ${id}`);
    assert.equal(entry.status, "OPEN");
    assert.equal(entry.critical, true);
    assert.match(String(entry.evidence), /no dated live run yet/i);
  }
  assert.equal(Object.keys(manifest.scenarios).length, 8);
});

test("harness fails closed today (exit 1) with all scenarios OPEN", () => {
  const result = runHarness(["--json"]);
  assert.equal(result.status, 1, `expected exit 1, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ready, false);
  assert.equal(report.name, "live-acceptance");
  assert.equal(report.schema_version, 1);
  assert.equal(report.summary.required_count, 8);
  assert.equal(report.summary.open_count, 8);
  assert.equal(report.summary.complete_count, 0);
  assert.equal(report.summary.scenarios_complete.length, 0);
  for (const id of REQUIRED_IDS) {
    assert.ok(report.summary.scenarios_open.includes(id), `expected OPEN ${id}`);
    assert.ok(report.summary.critical_open.includes(id), `expected critical OPEN ${id}`);
  }
  assert.equal(report.scenarios.length, 8);
  for (const s of report.scenarios) {
    assert.equal(s.status, "OPEN");
    assert.equal(s.critical, true);
    assert.equal(typeof s.label, "string");
    assert.ok(s.label.length > 0);
    assert.equal(typeof s.evidence, "string");
    assert.ok(s.evidence.length > 0);
  }
});

test("JSON shape includes topology, exit_policy, and evidence-only notes", () => {
  const report = JSON.parse(runHarness(["--json"]).stdout);
  assert.match(report.topology, /Helix gateway/i);
  assert.match(report.topology, /PostgreSQL/i);
  assert.match(report.exit_policy, /fail-closed/i);
  assert.ok(Array.isArray(report.notes));
  assert.ok(report.notes.some((n) => /does not itself run against production/i.test(n)));
  assert.ok(report.notes.some((n) => /static agentic-deploy-readiness/i.test(n)));
});

test("docs describe eight scenarios and relation to static gate", () => {
  const doc = fs.readFileSync(DOCS, "utf8");
  for (const id of REQUIRED_IDS) {
    assert.match(doc, new RegExp(id));
  }
  assert.match(doc, /verify:agentic-deploy-readiness/);
  assert.match(doc, /fail-closed/i);
  assert.match(doc, /authenticated client -> Helix gateway -> PostgreSQL -> worker -> Kali/);
  assert.match(doc, /not.*live reproduction|does not.*run against Helix/i);
});

test("harness and starter artifacts do not leak secret-like patterns", () => {
  const blobs = [
    fs.readFileSync(SCRIPT, "utf8"),
    fs.readFileSync(MANIFEST, "utf8"),
    fs.readFileSync(DOCS, "utf8"),
    runHarness(["--json"]).stdout,
    runHarness([]).stdout
  ];
  for (const blob of blobs) {
    for (const re of SECRETISH) {
      assert.doesNotMatch(blob, re, `secret-like pattern ${re} found`);
    }
  }
});

test("static gate live_acceptance_automation remains OPEN with starter evidence", () => {
  const staticScript = path.join(ROOT, "scripts/verify-agentic-deploy-readiness.mjs");
  const result = spawnSync(process.execPath, [staticScript, "--json"], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.ok(report.summary.critical_open.includes("live_acceptance_automation"));
  const gate = report.gates.find((g) => g.id === "live_acceptance_automation");
  assert.ok(gate);
  assert.equal(gate.status, "OPEN");
  assert.match(gate.evidence, /OPEN or undated|live-acceptance scenarios still OPEN/i);
});
