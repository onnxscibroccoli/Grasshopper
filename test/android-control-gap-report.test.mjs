import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const reporter = path.join(root, "scripts/cloud-android/report-control-evidence-gaps.mjs");
const allGates = ["delivery", "visible_acknowledgement", "semantic_effect", "reconnect_continuity"];

function artifact(dir, name, content) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return { path: name, sha256: crypto.createHash("sha256").update(content).digest("hex"), bytes: Buffer.byteLength(content) };
}

function evidence(origin, transport, node) {
  return {
    schema: "grasshopper.android-control-evidence/v1",
    contract_id: `TEST-GAP-${origin}`,
    captured_utc: "2026-10-08T23:30:00Z",
    collection_mode: "TEST_FIXTURE",
    source: { source_sha: "0123456789abcdef0123456789abcdef01234567", node_identity: node, transport, control_origin: origin, session_id: "session-gap-1" },
    delivery: { status: "NOT_PROVEN", sequence: 9, operation_id: "NOT_PROVEN", dispatch_disposition: "NOT_PROVEN", artifact: null },
    visible_acknowledgement: { status: "NOT_PROVEN", ack_for_sequence: 9, before_frame: null, after_frame: null },
    semantic_effect: { status: "NOT_PROVEN", ack_for_sequence: 9, expected: "", observed: "", artifact: null },
    reconnect_continuity: { status: "NOT_PROVEN", session_id_before: "", session_id_after: "", sequence_before: 0, sequence_after: 0, client_disconnect_only: false, guest_restarted: false, artifact: null },
    declared_status: "NOT_PROVEN",
    r2: "NOT_PROVEN",
  };
}

function digest(file) {
  const bytes = fs.readFileSync(file);
  return { path: path.basename(file), sha256: crypto.createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length };
}

function makeBundle(mutator = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-gap-report-"));
  const specs = [["workstation", "RFB", "oci"], ["browser", "noVNC", "browser"], ["physical_android", "broccoli-rish-observation", "SM-A146U"]];
  const records = Object.fromEntries(specs.map(([origin, transport, node]) => [origin, evidence(origin, transport, node)]));
  mutator(records, dir);
  const entries = specs.map(([origin, transport, node]) => {
    const file = path.join(dir, `${origin}.json`);
    fs.writeFileSync(file, `${JSON.stringify(records[origin], null, 2)}\n`);
    return { origin, node_identity: node, transport, session_id: "session-gap-1", artifact: digest(file) };
  });
  const bundle = {
    schema: "grasshopper.android-control-evidence-bundle/v1",
    contract_id: "TEST-GAP-BUNDLE",
    captured_utc: "2026-10-08T23:31:00Z",
    collection_mode: "TEST_FIXTURE",
    binding: { source_sha: "0123456789abcdef0123456789abcdef01234567", session_id: "session-gap-1" },
    entries,
    declared_status: "NOT_PROVEN",
    live_acceptance: false,
    r2: "NOT_PROVEN",
  };
  const file = path.join(dir, "bundle.json");
  fs.writeFileSync(file, `${JSON.stringify(bundle, null, 2)}\n`);
  return { dir, file, bundle };
}

function run(file) { return spawnSync(process.execPath, [reporter, file], { cwd: root, encoding: "utf8" }); }

function withBundle(mutator, assertion) {
  const fixture = makeBundle(mutator);
  try { assertion(fixture); } finally { fs.rmSync(fixture.dir, { recursive: true, force: true }); }
}

test("reports missing gates independently for every origin", () => {
  withBundle(() => {}, ({ file }) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    for (const origin of ["workstation", "browser", "physical_android"]) {
      assert.deepEqual(report.origins[origin].missing_gates, allGates);
    }
    assert.equal("combined_gates" in report, false);
  });
});

test("retains exact bundle, source, session, node, transport and artifact bindings", () => {
  withBundle(() => {}, ({ file, bundle }) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    const bundleBytes = fs.readFileSync(file);
    assert.equal(report.bundle.sha256, crypto.createHash("sha256").update(bundleBytes).digest("hex"));
    assert.equal(report.bundle.bytes, bundleBytes.length);
    assert.deepEqual(report.binding, bundle.binding);
    for (const entry of bundle.entries) {
      assert.equal(report.origins[entry.origin].node_identity, entry.node_identity);
      assert.equal(report.origins[entry.origin].transport, entry.transport);
      assert.equal(report.origins[entry.origin].session_id, entry.session_id);
      assert.equal(report.origins[entry.origin].evidence_sha256, entry.artifact.sha256);
    }
  });
});

test("does not combine complementary PASS gates across origins", () => {
  withBundle((records, dir) => {
    records.workstation.delivery = { status: "PASS", sequence: 9, operation_id: "op-9", dispatch_disposition: "ORIGINAL_DISPATCH", artifact: artifact(dir, "workstation-delivery.txt", "delivered\n") };
    records.browser.reconnect_continuity = { status: "PASS", session_id_before: "session-gap-1", session_id_after: "session-gap-1", sequence_before: 9, sequence_after: 10, client_disconnect_only: true, guest_restarted: false, artifact: artifact(dir, "browser-reconnect.txt", "reconnected\n") };
  }, ({ file }) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.origins.workstation.missing_gates, ["visible_acknowledgement", "semantic_effect", "reconnect_continuity"]);
    assert.deepEqual(report.origins.browser.missing_gates, ["delivery", "visible_acknowledgement", "semantic_effect"]);
    assert.deepEqual(report.origins.physical_android.missing_gates, allGates);
    assert.equal(report.overall_status, "NOT_PROVEN");
  });
});

test("TEST_FIXTURE gap report cannot claim live acceptance or R2", () => {
  withBundle(() => {}, ({ file }) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.collection_mode, "TEST_FIXTURE");
    assert.equal(report.live_acceptance, false);
    assert.equal(report.r2, "NOT_PROVEN");
    assert.equal(report.overall_status, "NOT_PROVEN");
  });
});

test("report contains no dispatch, replay or connection action", () => {
  withBundle(() => {}, ({ file }) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
    const reportText = result.stdout;
    assert.doesNotMatch(reportText, /"action"|"command"|"dispatch"|"replay"|"connect"/);
  });
});

test("tampered evidence fails before a gap report is emitted", () => {
  withBundle(() => {}, ({ file, bundle, dir }) => {
    fs.appendFileSync(path.join(dir, bundle.entries[0].artifact.path), "tamper\n");
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /byte count mismatch|digest mismatch/);
  });
});

test("malformed bundle fails closed", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-gap-invalid-"));
  const file = path.join(dir, "bundle.json");
  fs.writeFileSync(file, "{}\n");
  try {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /schema invalid/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("repository command emits a fail-closed template gap report", () => {
  const result = spawnSync("npm", ["run", "report:android-control-gaps"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(report.overall_status, "NOT_PROVEN");
  assert.equal(report.live_acceptance, false);
  assert.equal(report.r2, "NOT_PROVEN");
});
