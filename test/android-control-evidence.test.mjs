import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const verifier = path.join(root, "scripts/cloud-android/verify-control-evidence.mjs");
const repositoryEvidence = path.join(root, "docs/implementation/evidence/ANDROID_CONTROL_EVIDENCE_TEMPLATE.json");

function writeArtifact(dir, name, content) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, content);
  return {
    path: name,
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    bytes: Buffer.byteLength(content),
  };
}

function completeFixture(dir) {
  const delivery = writeArtifact(dir, "delivery.txt", "input sequence 41 delivered\n");
  const before = writeArtifact(dir, "before.frame", "before-frame\n");
  const after = writeArtifact(dir, "after.frame", "after-frame-changed\n");
  const semantic = writeArtifact(dir, "semantic.txt", "HOME surface observed\n");
  const reconnect = writeArtifact(dir, "reconnect.txt", "same session after client reconnect\n");
  return {
    schema: "grasshopper.android-control-evidence/v1",
    contract_id: "TEST-CONTROL-EVIDENCE",
    captured_utc: "2026-10-08T18:00:00Z",
    collection_mode: "TEST_FIXTURE",
    source: {
      source_sha: "0123456789abcdef0123456789abcdef01234567",
      node_identity: "fixture-node",
      transport: "provider-neutral-test",
      control_origin: "workstation",
      session_id: "session-1",
    },
    delivery: {
      status: "PASS",
      sequence: 41,
      operation_id: "op-41",
      dispatch_disposition: "ORIGINAL_DISPATCH",
      artifact: delivery,
    },
    visible_acknowledgement: {
      status: "PASS",
      ack_for_sequence: 41,
      before_frame: before,
      after_frame: after,
    },
    semantic_effect: {
      status: "PASS",
      ack_for_sequence: 41,
      expected: "HOME surface is foreground",
      observed: "HOME surface observed",
      artifact: semantic,
    },
    reconnect_continuity: {
      status: "PASS",
      session_id_before: "session-1",
      session_id_after: "session-1",
      sequence_before: 41,
      sequence_after: 42,
      client_disconnect_only: true,
      guest_restarted: false,
      artifact: reconnect,
    },
    declared_status: "NOT_PROVEN",
    r2: "NOT_PROVEN",
  };
}

function withEvidence(mutator, action) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-control-evidence-"));
  const evidence = completeFixture(dir);
  mutator(evidence, dir);
  const file = path.join(dir, "evidence.json");
  fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  try {
    return action(file, evidence, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(file) {
  return spawnSync(process.execPath, [verifier, file], { cwd: root, encoding: "utf8" });
}

test("complete synthetic control evidence cannot claim live acceptance", () => {
  withEvidence(() => {}, (file) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.overall_status, "NOT_PROVEN");
    assert.equal(report.live_acceptance, false);
    assert.deepEqual(report.gates, {
      delivery: "PASS",
      visible_acknowledgement: "PASS",
      semantic_effect: "PASS",
      reconnect_continuity: "PASS",
    });
  });
});

test("visible acknowledgement does not imply semantic effect", () => {
  withEvidence((evidence) => {
    evidence.semantic_effect.status = "NOT_PROVEN";
    evidence.semantic_effect.artifact = null;
    evidence.semantic_effect.observed = "";
  }, (file) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.gates.visible_acknowledgement, "PASS");
    assert.equal(report.gates.semantic_effect, "NOT_PROVEN");
    assert.equal(report.overall_status, "NOT_PROVEN");
  });
});

test("a PASS gate fails closed when its artifact is missing", () => {
  withEvidence((evidence, dir) => {
    fs.rmSync(path.join(dir, evidence.delivery.artifact.path));
  }, (file) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /delivery artifact does not exist/);
  });
});

test("reconnect PASS rejects a changed session identity", () => {
  withEvidence((evidence) => {
    evidence.reconnect_continuity.session_id_after = "replacement-session";
  }, (file) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /reconnect session identity changed/);
  });
});

test("schema rejects an unbound source identity", () => {
  withEvidence((evidence) => {
    evidence.source.source_sha = "not-a-commit";
  }, (file) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source\/source_sha: must match/);
  });
});

test("repository evidence template validates as NOT_PROVEN", () => {
  const result = spawnSync("npm", ["run", "verify:android-control-evidence"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const line = result.stdout.trim().split("\n").at(-1);
  const report = JSON.parse(line);
  assert.equal(report.overall_status, "NOT_PROVEN");
  assert.equal(report.live_acceptance, false);
});
