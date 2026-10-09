import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const reporter = path.join(root, "scripts/cloud-android/report-control-acquisition-coverage.mjs");
const evidenceDir = path.join(root, "docs/implementation/evidence");
const fixedAt = "2026-10-09T00:35:00Z";
const gates = ["delivery", "visible_acknowledgement", "semantic_effect", "reconnect_continuity"];

function makeFixture(mutator = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-acquisition-coverage-"));
  const names = [
    "ANDROID_CONTROL_ACQUISITION_RECEIPT_TEMPLATE.json",
    "ANDROID_CONTROL_ACQUISITION_REQUIREMENTS_TEMPLATE.json",
    "ANDROID_CONTROL_GAP_REPORT_TEMPLATE.json",
    "ANDROID_CONTROL_EVIDENCE_BUNDLE_TEMPLATE.json",
    "ANDROID_CONTROL_BUNDLE_WORKSTATION_TEMPLATE.json",
    "ANDROID_CONTROL_BUNDLE_BROWSER_TEMPLATE.json",
    "ANDROID_CONTROL_BUNDLE_PHYSICAL_ANDROID_TEMPLATE.json",
  ];
  for (const name of names) fs.copyFileSync(path.join(evidenceDir, name), path.join(dir, name));
  const receiptFile = path.join(dir, names[0]);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
  mutator(receipt, { dir });
  fs.writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
  return {
    dir,
    receipt,
    receiptFile,
    requirementsFile: path.join(dir, names[1]),
    gapFile: path.join(dir, names[2]),
    bundleFile: path.join(dir, names[3]),
  };
}

function run(fixture, at = fixedAt) {
  return spawnSync(process.execPath, [
    reporter,
    fixture.receiptFile,
    fixture.requirementsFile,
    fixture.gapFile,
    fixture.bundleFile,
    "--at",
    at,
  ], { cwd: root, encoding: "utf8" });
}

function withFixture(mutator, assertion) {
  const fixture = makeFixture(mutator);
  try { assertion(fixture); } finally { fs.rmSync(fixture.dir, { recursive: true, force: true }); }
}

function fillOrigin(origin) {
  const artifact = origin.entries[0].artifact;
  origin.entries = gates.map((gate) => ({ gate, artifact: structuredClone(artifact) }));
}

test("reports bound and still-uncollected gates separately per origin", () => {
  withFixture(() => {}, (fixture) => {
    const result = run(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.coverage_status, "INCOMPLETE_ARTIFACT_BINDING");
    assert.deepEqual(report.origins.workstation.artifact_bound_gates, ["delivery"]);
    assert.deepEqual(report.origins.workstation.still_uncollected_gates, gates.slice(1));
    assert.equal(report.origins.workstation.gate_states.delivery, "ARTIFACT_BOUND_NOT_ACCEPTANCE");
    assert.equal(report.origins.workstation.gate_states.semantic_effect, "NOT_COLLECTED");
  });
});

test("retains source, session, process, node, transport and artifact bindings", () => {
  withFixture(() => {}, (fixture) => {
    const result = run(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.binding, fixture.receipt.binding);
    assert.deepEqual(report.guest_process, fixture.receipt.guest_process);
    assert.equal(report.origins.browser.node_identity, fixture.receipt.origins[1].node_identity);
    assert.equal(report.origins.browser.transport, fixture.receipt.origins[1].transport);
    assert.deepEqual(report.origins.browser.artifacts.delivery, fixture.receipt.origins[1].entries[0].artifact);
  });
});

test("complete synthetic artifact binding is still not acceptance", () => {
  withFixture((receipt) => receipt.origins.forEach(fillOrigin), (fixture) => {
    const result = run(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.coverage_status, "COMPLETE_ARTIFACT_BINDING_NOT_ACCEPTANCE");
    assert.deepEqual(report.origins.physical_android.still_uncollected_gates, []);
    assert.equal(report.overall_status, "NOT_PROVEN");
    assert.equal(report.live_acceptance, false);
    assert.equal(report.r2, "NOT_PROVEN");
  });
});

test("one origin cannot satisfy another origin's missing gates", () => {
  withFixture((receipt) => fillOrigin(receipt.origins[0]), (fixture) => {
    const result = run(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.origins.workstation.still_uncollected_gates, []);
    assert.deepEqual(report.origins.browser.still_uncollected_gates, gates.slice(1));
    assert.deepEqual(report.origins.physical_android.still_uncollected_gates, gates.slice(1));
  });
});

test("report contains no executable remediation or inferred PASS", () => {
  withFixture(() => {}, (fixture) => {
    const result = run(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.reporter_dispatches_or_connects, false);
    assert.equal(Object.hasOwn(report, "command"), false);
    assert.equal(Object.hasOwn(report, "action"), false);
    assert.doesNotMatch(JSON.stringify(report.origins), /"PASS"/);
  });
});

test("tampered receipt fails before any coverage report is emitted", () => {
  withFixture((receipt) => { receipt.origins[0].entries[0].artifact.sha256 = "b".repeat(64); }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /artifact digest mismatch/);
  });
});

test("expired requirements fail before any coverage report is emitted", () => {
  withFixture(() => {}, (fixture) => {
    const result = run(fixture, "2026-10-09T00:50:01Z");
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /requirements expired/);
  });
});

test("fixture relabeling fails closed", () => {
  withFixture((receipt) => { receipt.collection_mode = "LIVE"; }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /collection mode mismatch/);
  });
});

test("repository command emits deterministic non-acceptance coverage", () => {
  const result = spawnSync("npm", ["run", "report:android-control-acquisition-coverage"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(report.coverage_status, "INCOMPLETE_ARTIFACT_BINDING");
  assert.equal(report.live_acceptance, false);
  assert.equal(report.r2, "NOT_PROVEN");
});
