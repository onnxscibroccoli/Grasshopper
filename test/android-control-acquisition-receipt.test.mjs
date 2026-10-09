import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const verifier = path.join(root, "scripts/cloud-android/verify-control-acquisition-receipt.mjs");
const evidenceDir = path.join(root, "docs/implementation/evidence");
const fixedAt = "2026-10-09T00:35:00Z";

function descriptor(file) {
  const bytes = fs.readFileSync(file);
  return {
    path: path.basename(file),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}

function makeFixture(mutator = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-acquisition-receipt-"));
  const names = [
    "ANDROID_CONTROL_ACQUISITION_REQUIREMENTS_TEMPLATE.json",
    "ANDROID_CONTROL_GAP_REPORT_TEMPLATE.json",
    "ANDROID_CONTROL_EVIDENCE_BUNDLE_TEMPLATE.json",
    "ANDROID_CONTROL_BUNDLE_WORKSTATION_TEMPLATE.json",
    "ANDROID_CONTROL_BUNDLE_BROWSER_TEMPLATE.json",
    "ANDROID_CONTROL_BUNDLE_PHYSICAL_ANDROID_TEMPLATE.json",
  ];
  for (const name of names) fs.copyFileSync(path.join(evidenceDir, name), path.join(dir, name));
  const requirementsFile = path.join(dir, names[0]);
  const requirements = JSON.parse(fs.readFileSync(requirementsFile, "utf8"));
  const artifacts = {
    workstation: path.join(dir, names[3]),
    browser: path.join(dir, names[4]),
    physical_android: path.join(dir, names[5]),
  };
  const receipt = {
    schema: "grasshopper.android-control-acquisition-receipt/v1",
    contract_id: "TEST-ACQUISITION-RECEIPT",
    collection_mode: "TEST_FIXTURE",
    collected_utc: "2026-10-09T00:34:00Z",
    requirements: descriptor(requirementsFile),
    binding: requirements.binding,
    guest_process: requirements.guest_process,
    origins: requirements.origins.map((origin) => ({
      origin: origin.origin,
      node_identity: origin.node_identity,
      transport: origin.transport,
      session_id: origin.session_id,
      entries: [{ gate: "delivery", artifact: descriptor(artifacts[origin.origin]) }],
    })),
    verification_mode: "RECEIPT_ONLY",
    verifier_dispatches_or_connects: false,
    live_acceptance: false,
    r2: "NOT_PROVEN",
  };
  mutator(receipt, { dir, requirements, requirementsFile, artifacts });
  const receiptFile = path.join(dir, "receipt.json");
  fs.writeFileSync(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`);
  return {
    dir,
    receiptFile,
    requirementsFile,
    gapFile: path.join(dir, names[1]),
    bundleFile: path.join(dir, names[2]),
    receipt,
  };
}

function run(fixture, at = fixedAt) {
  return spawnSync(process.execPath, [
    verifier,
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

test("valid synthetic receipt binds artifacts but proves no gate or live acceptance", () => {
  withFixture(() => {}, (fixture) => {
    const result = run(fixture);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.receipt_status, "VALID_ARTIFACT_BINDING_NOT_ACCEPTANCE");
    assert.deepEqual(report.origins.workstation, { delivery: "ARTIFACT_BOUND" });
    assert.equal(report.live_acceptance, false);
    assert.equal(report.r2, "NOT_PROVEN");
  });
});

test("requirements bytes are bound exactly", () => {
  withFixture(() => {}, (fixture) => {
    fs.appendFileSync(fixture.requirementsFile, " \n");
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requirements byte count mismatch|requirements digest mismatch/);
  });
});

test("receipt cannot outlive its requirements", () => {
  withFixture(() => {}, (fixture) => {
    const result = run(fixture, "2026-10-09T00:50:01Z");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requirements expired/);
  });
});

test("guest process substitution fails closed", () => {
  withFixture((receipt) => { receipt.guest_process.pid += 1; }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /guest process mismatch/);
  });
});

test("source or session substitution fails closed", () => {
  withFixture((receipt) => { receipt.binding.session_id = "replacement"; }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source\/session binding mismatch/);
  });
});

test("cross-origin gate substitution fails closed", () => {
  withFixture((receipt) => {
    receipt.origins.find((entry) => entry.origin === "browser").node_identity = "NOT_PROVEN_WORKSTATION";
  }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /browser node identity mismatch/);
  });
});

test("duplicate gate receipts fail closed instead of combining evidence", () => {
  withFixture((receipt) => {
    const workstation = receipt.origins.find((entry) => entry.origin === "workstation");
    workstation.entries.push(structuredClone(workstation.entries[0]));
  }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate workstation gate/);
  });
});

test("artifact tampering and path traversal fail closed", () => {
  withFixture((receipt) => {
    receipt.origins[0].entries[0].artifact.path = "../outside";
  }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /artifact path must remain inside receipt directory/);
  });
});

test("artifact bytes cannot change after receipt creation", () => {
  withFixture(() => {}, (fixture) => {
    const artifact = fixture.receipt.origins[0].entries[0].artifact;
    fs.appendFileSync(path.join(fixture.dir, artifact.path), "tampered\n");
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /artifact byte count mismatch|artifact digest mismatch/);
  });
});

test("fixture receipt cannot be relabeled LIVE", () => {
  withFixture((receipt) => { receipt.collection_mode = "LIVE"; }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /collection mode mismatch/);
  });
});

test("schema rejects executable command fields", () => {
  withFixture((receipt) => { receipt.command = "adb shell input keyevent HOME"; }, (fixture) => {
    const result = run(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /schema invalid.*command: additional property is not allowed/);
  });
});

test("repository command verifies template without promoting acceptance", () => {
  const result = spawnSync("npm", ["run", "verify:android-control-acquisition-receipt"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(report.receipt_status, "VALID_ARTIFACT_BINDING_NOT_ACCEPTANCE");
  assert.equal(report.live_acceptance, false);
  assert.equal(report.r2, "NOT_PROVEN");
});
