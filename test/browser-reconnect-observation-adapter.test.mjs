import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const adapter = path.join(root, "scripts/cloud-android/adapt-browser-reconnect-observation.mjs");
const verifier = path.join(root, "scripts/cloud-android/verify-control-evidence.mjs");

function digestArtifact(dir, name, content) {
  const bytes = Buffer.from(content);
  fs.writeFileSync(path.join(dir, name), bytes);
  return {
    path: name,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes: bytes.length,
  };
}

function reconnectRecord(overrides = {}) {
  return {
    schema: "grasshopper.browser-reconnect-record/v1",
    source_sha: "0123456789abcdef0123456789abcdef01234567",
    node_identity: "fixture-cloud-android",
    transport: "noVNC-RFB-websocket",
    session_id_before: "guest-session-7",
    session_id_after: "guest-session-7",
    sequence_before: 71,
    sequence_after: 72,
    client_disconnect_only: true,
    guest_restarted: false,
    disconnected_utc: "2026-10-08T20:00:00Z",
    reconnected_utc: "2026-10-08T20:00:05Z",
    ...overrides,
  };
}

function fixture(dir, recordOverrides = {}) {
  const record = reconnectRecord(recordOverrides);
  return {
    observation: {
      schema: "grasshopper.browser-reconnect-observation/v1",
      contract_id: "TEST-BROWSER-RECONNECT",
      captured_utc: "2026-10-08T20:00:06Z",
      collection_mode: "TEST_FIXTURE",
      source: {
        source_sha: record.source_sha,
        node_identity: record.node_identity,
        transport: record.transport,
        control_origin: "browser",
        session_id: record.session_id_before,
      },
      observation_only: true,
      reconnect_record: digestArtifact(dir, "reconnect-record.json", `${JSON.stringify(record, null, 2)}\n`),
    },
    record,
  };
}

function withFixture(recordOverrides, mutator, action) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-browser-reconnect-"));
  const { observation, record } = fixture(dir, recordOverrides);
  mutator(observation, record, dir);
  const inputFile = path.join(dir, "observation.json");
  const outputFile = path.join(dir, "control-evidence.json");
  fs.writeFileSync(inputFile, `${JSON.stringify(observation, null, 2)}\n`);
  try {
    return action({ dir, observation, record, inputFile, outputFile });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(inputFile, outputFile) {
  return spawnSync(process.execPath, [adapter, inputFile, outputFile], { cwd: root, encoding: "utf8" });
}

test("adapts an independent reconnect record while leaving unrelated gates unproven", () => {
  withFixture({}, () => {}, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    assert.equal(evidence.delivery.status, "NOT_PROVEN");
    assert.equal(evidence.visible_acknowledgement.status, "NOT_PROVEN");
    assert.equal(evidence.semantic_effect.status, "NOT_PROVEN");
    assert.equal(evidence.reconnect_continuity.status, "PASS");
    assert.equal(evidence.reconnect_continuity.session_id_before, "guest-session-7");
    assert.equal(evidence.reconnect_continuity.sequence_before, 71);
    assert.equal(evidence.reconnect_continuity.sequence_after, 72);
    assert.equal(evidence.declared_status, "NOT_PROVEN");
    assert.equal(evidence.r2, "NOT_PROVEN");

    const verified = spawnSync(process.execPath, [verifier, outputFile], { cwd: root, encoding: "utf8" });
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(JSON.parse(verified.stdout).live_acceptance, false);
  });
});

test("rejects a reconnect record whose session identity changed", () => {
  withFixture({ session_id_after: "replacement-session" }, () => {}, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /session identity changed/);
  });
});

test("rejects a reconnect record without an advancing sequence", () => {
  withFixture({ sequence_after: 71 }, () => {}, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /sequence did not advance/);
  });
});

test("rejects a reconnect that restarted the guest or was not client-only", () => {
  for (const overrides of [{ guest_restarted: true }, { client_disconnect_only: false }]) {
    withFixture(overrides, () => {}, ({ inputFile, outputFile }) => {
      const result = run(inputFile, outputFile);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /client-only disconnect without guest restart/);
    });
  }
});

test("rejects a tampered reconnect record", () => {
  withFixture({}, (observation, _record, dir) => {
    fs.appendFileSync(path.join(dir, observation.reconnect_record.path), "tampered\n");
  }, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /reconnect record (byte count|digest) mismatch/);
  });
});

test("rejects record identity that does not match the observation source", () => {
  withFixture({}, (observation) => {
    observation.source.node_identity = "different-node";
  }, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /record identity does not match observation source/);
  });
});

test("rejects input that is not observation-only", () => {
  withFixture({}, (observation) => { observation.observation_only = false; }, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /observation_only must be true/);
  });
});

test("refuses to overwrite existing control evidence", () => {
  withFixture({}, () => {}, ({ inputFile, outputFile }) => {
    fs.writeFileSync(outputFile, "preserve-me\n");
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(outputFile, "utf8"), "preserve-me\n");
  });
});
