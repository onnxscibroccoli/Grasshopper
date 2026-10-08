import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const verifier = path.join(root, "scripts/cloud-android/verify-control-evidence-bundle.mjs");

function digestFile(file) {
  const bytes = fs.readFileSync(file);
  return {
    path: path.basename(file),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}

function evidence(origin, transport, node, session = "guest-session-1", sourceSha = "0123456789abcdef0123456789abcdef01234567") {
  return {
    schema: "grasshopper.android-control-evidence/v1",
    contract_id: `TEST-${origin}`,
    captured_utc: "2026-10-08T22:00:00Z",
    collection_mode: "TEST_FIXTURE",
    source: { source_sha: sourceSha, node_identity: node, transport, control_origin: origin, session_id: session },
    delivery: { status: "NOT_PROVEN", sequence: 7, operation_id: "NOT_PROVEN", dispatch_disposition: "NOT_PROVEN", artifact: null },
    visible_acknowledgement: { status: "NOT_PROVEN", ack_for_sequence: 7, before_frame: null, after_frame: null },
    semantic_effect: { status: "NOT_PROVEN", ack_for_sequence: 7, expected: "", observed: "", artifact: null },
    reconnect_continuity: { status: "NOT_PROVEN", session_id_before: "", session_id_after: "", sequence_before: 0, sequence_after: 0, client_disconnect_only: false, guest_restarted: false, artifact: null },
    declared_status: "NOT_PROVEN",
    r2: "NOT_PROVEN",
  };
}

function makeFixture(mutator = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-control-bundle-"));
  const specs = [
    ["workstation", "RFB", "oci-workstation"],
    ["browser", "noVNC-websocket", "browser-client"],
    ["physical_android", "broccoli-rish-observation", "SM-A146U"],
  ];
  const entries = specs.map(([origin, transport, node]) => {
    const file = path.join(dir, `${origin}.json`);
    fs.writeFileSync(file, `${JSON.stringify(evidence(origin, transport, node), null, 2)}\n`);
    return { origin, node_identity: node, transport, session_id: "guest-session-1", artifact: digestFile(file) };
  });
  const bundle = {
    schema: "grasshopper.android-control-evidence-bundle/v1",
    contract_id: "TEST-CONTROL-BUNDLE",
    captured_utc: "2026-10-08T22:05:00Z",
    collection_mode: "TEST_FIXTURE",
    binding: { source_sha: "0123456789abcdef0123456789abcdef01234567", session_id: "guest-session-1" },
    entries,
    declared_status: "NOT_PROVEN",
    live_acceptance: false,
    r2: "NOT_PROVEN",
  };
  mutator(bundle, dir);
  const file = path.join(dir, "bundle.json");
  fs.writeFileSync(file, `${JSON.stringify(bundle, null, 2)}\n`);
  return { dir, file };
}

function run(file) {
  return spawnSync(process.execPath, [verifier, file], { cwd: root, encoding: "utf8" });
}

function withFixture(mutator, assertion) {
  const fixture = makeFixture(mutator);
  try { assertion(fixture); } finally { fs.rmSync(fixture.dir, { recursive: true, force: true }); }
}

test("valid three-origin fixture remains NOT_PROVEN without cross-origin gate aggregation", () => {
  withFixture(() => {}, ({ file }) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.overall_status, "NOT_PROVEN");
    assert.equal(report.live_acceptance, false);
    assert.equal(report.r2, "NOT_PROVEN");
    assert.deepEqual(Object.keys(report.origins).sort(), ["browser", "physical_android", "workstation"]);
    assert.equal("gates" in report, false);
  });
});

test("duplicate origin fails closed", () => {
  withFixture((bundle) => { bundle.entries[1].origin = "workstation"; }, ({ file }) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate origin|origin mismatch/);
  });
});

test("cross-transport substitution fails closed", () => {
  withFixture((bundle) => { bundle.entries[0].transport = "noVNC-websocket"; }, ({ file }) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /transport mismatch/);
  });
});

test("cross-node substitution fails closed", () => {
  withFixture((bundle) => { bundle.entries[2].node_identity = "different-phone"; }, ({ file }) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /node identity mismatch/);
  });
});

test("mixed source identity fails closed", () => {
  withFixture((bundle, dir) => {
    const file = path.join(dir, "browser.json");
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    value.source.source_sha = "abcdef0123456789abcdef0123456789abcdef01";
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    bundle.entries[1].artifact = digestFile(file);
  }, ({ file }) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source SHA mismatch/);
  });
});

test("mixed session identity fails closed", () => {
  withFixture((bundle, dir) => {
    const file = path.join(dir, "browser.json");
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    value.source.session_id = "replacement-session";
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    bundle.entries[1].artifact = digestFile(file);
  }, ({ file }) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /session mismatch/);
  });
});

test("missing or tampered evidence artifact fails closed", () => {
  withFixture((bundle, dir) => { fs.appendFileSync(path.join(dir, bundle.entries[0].artifact.path), "tampered\n"); }, ({ file }) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /byte count mismatch|digest mismatch/);
  });
});

test("TEST_FIXTURE cannot be promoted by a LIVE bundle label", () => {
  withFixture((bundle) => { bundle.collection_mode = "LIVE"; }, ({ file }) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /collection mode mismatch/);
  });
});

test("all three distinct origins are required", () => {
  withFixture((bundle) => { bundle.entries.pop(); }, ({ file }) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /at least 3 item|exactly workstation, browser, and physical_android/);
  });
});

test("repository bundle template verifies as NOT_PROVEN", () => {
  const result = spawnSync("npm", ["run", "verify:android-control-evidence-bundle"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(report.overall_status, "NOT_PROVEN");
  assert.equal(report.live_acceptance, false);
  assert.equal(report.r2, "NOT_PROVEN");
});
