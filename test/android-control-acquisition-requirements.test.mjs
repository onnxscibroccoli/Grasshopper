import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const verifier = path.join(root, "scripts/cloud-android/verify-control-acquisition-requirements.mjs");
const reporter = path.join(root, "scripts/cloud-android/report-control-evidence-gaps.mjs");
const evidenceDir = path.join(root, "docs/implementation/evidence");
const fixedAt = "2026-10-09T00:35:00Z";

function boundFile(file) {
  const bytes = fs.readFileSync(file);
  return { path: path.basename(file), sha256: crypto.createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
}

function makeFixture(mutator = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-acquisition-"));
  for (const name of [
    "ANDROID_CONTROL_EVIDENCE_BUNDLE_TEMPLATE.json",
    "ANDROID_CONTROL_BUNDLE_WORKSTATION_TEMPLATE.json",
    "ANDROID_CONTROL_BUNDLE_BROWSER_TEMPLATE.json",
    "ANDROID_CONTROL_BUNDLE_PHYSICAL_ANDROID_TEMPLATE.json",
  ]) fs.copyFileSync(path.join(evidenceDir, name), path.join(dir, name));
  const bundleFile = path.join(dir, "ANDROID_CONTROL_EVIDENCE_BUNDLE_TEMPLATE.json");
  const gapResult = spawnSync(process.execPath, [reporter, bundleFile], { cwd: root, encoding: "utf8" });
  assert.equal(gapResult.status, 0, gapResult.stderr);
  const gapFile = path.join(dir, "gap-report.json");
  fs.writeFileSync(gapFile, `${JSON.stringify(JSON.parse(gapResult.stdout), null, 2)}\n`);
  const gap = JSON.parse(fs.readFileSync(gapFile, "utf8"));
  const requirements = {
    schema: "grasshopper.android-control-acquisition-requirements/v1",
    contract_id: "TEST-ACQUISITION-REQUIREMENTS",
    collection_mode: "TEST_FIXTURE",
    issued_utc: "2026-10-09T00:32:00Z",
    expires_utc: "2026-10-09T00:50:00Z",
    gap_report: boundFile(gapFile),
    binding: gap.binding,
    guest_process: {
      node_identity: "fixture-oci-node",
      pid: 4242,
      started_utc: "2026-10-09T00:00:00Z",
      observed_utc: "2026-10-09T00:31:00Z",
      fingerprint_sha256: "a".repeat(64),
    },
    origins: Object.entries(gap.origins).map(([origin, value]) => ({
      origin,
      node_identity: value.node_identity,
      transport: value.transport,
      session_id: value.session_id,
      evidence_sha256: value.evidence_sha256,
      required_gates: value.missing_gates,
    })),
    execution_mode: "NON_EXECUTABLE_REQUIREMENTS",
    collection_authorized: false,
    live_acceptance: false,
    r2: "NOT_PROVEN",
  };
  mutator(requirements, { dir, gapFile, bundleFile, gap });
  const requirementsFile = path.join(dir, "requirements.json");
  fs.writeFileSync(requirementsFile, `${JSON.stringify(requirements, null, 2)}\n`);
  return { dir, requirementsFile, gapFile, bundleFile, requirements };
}

function run(fixture, at = fixedAt) {
  return spawnSync(process.execPath, [verifier, fixture.requirementsFile, fixture.gapFile, fixture.bundleFile, "--at", at], { cwd: root, encoding: "utf8" });
}

function withFixture(mutator, assertion) {
  const fixture = makeFixture(mutator);
  try { assertion(fixture); } finally { fs.rmSync(fixture.dir, { recursive: true, force: true }); }
}

test("valid synthetic requirements remain non-executable and NOT_PROVEN", () => {
  withFixture(() => {}, (fixture) => {
    const result = run(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.requirements_status, "VALID_NON_EXECUTABLE");
    assert.equal(report.collection_authorized, false);
    assert.equal(report.live_acceptance, false);
    assert.equal(report.r2, "NOT_PROVEN");
  });
});

test("gap report bytes and regenerated content are both verified", () => {
  withFixture(() => {}, (fixture) => {
    fs.appendFileSync(fixture.gapFile, " \n");
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /gap report byte count mismatch|gap report digest mismatch/);
  });
});

test("source and session substitution fail closed", () => {
  withFixture((requirements) => { requirements.binding.session_id = "replacement"; }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /binding mismatch/);
  });
});

test("stale guest-process identity expires", () => {
  withFixture(() => {}, (fixture) => {
    const result = run(fixture, "2026-10-09T00:50:01Z");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requirements expired/);
  });
});

test("future or stale process observation fails freshness", () => {
  withFixture((requirements) => { requirements.guest_process.observed_utc = "2026-10-09T00:40:00Z"; }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /observation must not follow issue time/);
  });
});

test("validity window cannot exceed twenty minutes from process observation", () => {
  withFixture((requirements) => { requirements.expires_utc = "2026-10-09T00:51:01Z"; }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /validity exceeds 20 minutes/);
  });
});

test("cross-origin gate substitution fails closed", () => {
  withFixture((requirements) => {
    requirements.origins.find((entry) => entry.origin === "workstation").required_gates = ["delivery"];
  }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /required gates mismatch/);
  });
});

test("schema rejects executable command or action fields", () => {
  withFixture((requirements) => { requirements.command = "adb shell input keyevent HOME"; }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /schema invalid.*command: additional property is not allowed/);
  });
});

test("repository command verifies the synthetic template without authorization", () => {
  const result = spawnSync("npm", ["run", "verify:android-control-acquisition-requirements"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(report.requirements_status, "VALID_NON_EXECUTABLE");
  assert.equal(report.collection_authorized, false);
  assert.equal(report.r2, "NOT_PROVEN");
});
