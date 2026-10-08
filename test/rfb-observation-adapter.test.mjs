import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const adapter = path.join(root, "scripts/cloud-android/adapt-rfb-observation.mjs");
const verifier = path.join(root, "scripts/cloud-android/verify-control-evidence.mjs");

function artifact(dir, name, content) {
  const bytes = Buffer.from(content);
  fs.writeFileSync(path.join(dir, name), bytes);
  return {
    path: name,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}

function fixture(dir) {
  return {
    schema: "grasshopper.rfb-observation/v1",
    contract_id: "TEST-RFB-OBSERVATION",
    captured_utc: "2026-10-08T19:00:00Z",
    collection_mode: "TEST_FIXTURE",
    source: {
      source_sha: "0123456789abcdef0123456789abcdef01234567",
      node_identity: "fixture-workstation",
      transport: "RFB",
      control_origin: "workstation",
      session_id: "rfb-session-1",
    },
    observed_sequence: 17,
    observed_operation_id: "observed-pointer-17",
    input_observed_only: true,
    before_frame: artifact(dir, "before.frame", "frame-before\n"),
    after_frame: artifact(dir, "after.frame", "frame-after\n"),
  };
}

function withFixture(mutator, action) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-rfb-adapter-"));
  const input = fixture(dir);
  mutator(input, dir);
  const inputFile = path.join(dir, "observation.json");
  const outputFile = path.join(dir, "control-evidence.json");
  fs.writeFileSync(inputFile, `${JSON.stringify(input, null, 2)}\n`);
  try {
    return action({ dir, input, inputFile, outputFile });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(inputFile, outputFile) {
  return spawnSync(process.execPath, [adapter, inputFile, outputFile], { cwd: root, encoding: "utf8" });
}

test("adapts changed RFB frames while retaining unproven control gates", () => {
  withFixture(() => {}, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    assert.equal(evidence.delivery.status, "NOT_PROVEN");
    assert.equal(evidence.delivery.dispatch_disposition, "NOT_PROVEN");
    assert.equal(evidence.delivery.sequence, 17);
    assert.equal(evidence.delivery.operation_id, "observed-pointer-17");
    assert.equal(evidence.visible_acknowledgement.status, "PASS");
    assert.equal(evidence.semantic_effect.status, "NOT_PROVEN");
    assert.equal(evidence.reconnect_continuity.status, "NOT_PROVEN");
    assert.equal(evidence.declared_status, "NOT_PROVEN");
    assert.equal(evidence.r2, "NOT_PROVEN");

    const verified = spawnSync(process.execPath, [verifier, outputFile], { cwd: root, encoding: "utf8" });
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(JSON.parse(verified.stdout).live_acceptance, false);
  });
});

test("never converts an observed operation into original dispatch", () => {
  withFixture(() => {}, ({ inputFile, outputFile }) => {
    assert.equal(run(inputFile, outputFile).status, 0);
    const evidence = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    assert.equal(evidence.delivery.artifact, null);
    assert.notEqual(evidence.delivery.dispatch_disposition, "ORIGINAL_DISPATCH");
  });
});

test("rejects a tampered frame artifact", () => {
  withFixture((input, dir) => {
    fs.appendFileSync(path.join(dir, input.after_frame.path), "tampered\n");
  }, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /after frame (byte count|digest) mismatch/);
  });
});

test("rejects input that is not observation-only", () => {
  withFixture((input) => { input.input_observed_only = false; }, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /input_observed_only must be true/);
  });
});

test("refuses to overwrite existing evidence", () => {
  withFixture(() => {}, ({ inputFile, outputFile }) => {
    fs.writeFileSync(outputFile, "preserve-me\n");
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(outputFile, "utf8"), "preserve-me\n");
  });
});

test("unchanged frames remain not proven rather than visual PASS", () => {
  withFixture((input, dir) => {
    fs.copyFileSync(path.join(dir, input.before_frame.path), path.join(dir, input.after_frame.path));
    input.after_frame.sha256 = input.before_frame.sha256;
    input.after_frame.bytes = input.before_frame.bytes;
  }, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    assert.equal(evidence.visible_acknowledgement.status, "NOT_PROVEN");
    assert.equal(evidence.visible_acknowledgement.before_frame, null);
    assert.equal(evidence.visible_acknowledgement.after_frame, null);
  });
});
