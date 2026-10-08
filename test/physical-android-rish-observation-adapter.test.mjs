import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const adapter = path.join(root, "scripts/cloud-android/adapt-physical-android-rish-observation.mjs");
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

function rishRecord(overrides = {}) {
  const base = {
    schema: "grasshopper.broccoli-rish-record/v1",
    source_sha: "0123456789abcdef0123456789abcdef01234567",
    node_identity: "SM-A146U",
    transport: "broccoli-rish",
    session_id: "physical-android-session-4",
    sequence: 93,
    captured_utc: "2026-10-08T21:45:00Z",
    wrapper: {
      repository: "onnxscibroccoli/broccoli-core",
      path: "lib/rish_run.sh",
      commit_sha: "1234567890abcdef1234567890abcdef12345678",
      blob_sha: "81414aa0f6a9f79db0a346fb8ab459824612cb64",
      rish_preserve_env: "0",
    },
    execution: {
      disposition: "OBSERVED_ONLY",
      exit_code: 0,
      uid: 2000,
      selinux_context: "u:r:shell:s0",
      device_model: "SM-A146U",
    },
  };
  return { ...base, ...overrides, wrapper: { ...base.wrapper, ...overrides.wrapper }, execution: { ...base.execution, ...overrides.execution } };
}

function fixture(dir, recordOverrides = {}) {
  const record = rishRecord(recordOverrides);
  return {
    observation: {
      schema: "grasshopper.physical-android-rish-observation/v1",
      contract_id: "TEST-PHYSICAL-ANDROID-RISH",
      captured_utc: "2026-10-08T21:45:01Z",
      collection_mode: "TEST_FIXTURE",
      source: {
        source_sha: record.source_sha,
        node_identity: record.node_identity,
        transport: record.transport,
        control_origin: "physical_android",
        session_id: record.session_id,
      },
      observation_only: true,
      rish_record: artifact(dir, "rish-record.json", `${JSON.stringify(record, null, 2)}\n`),
    },
    record,
  };
}

function withFixture(recordOverrides, mutator, action) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-physical-rish-"));
  const { observation, record } = fixture(dir, recordOverrides);
  mutator(observation, record, dir);
  const inputFile = path.join(dir, "observation.json");
  const outputFile = path.join(dir, "control-evidence.json");
  fs.writeFileSync(inputFile, `${JSON.stringify(observation, null, 2)}\n`);
  try {
    return action({ observation, record, dir, inputFile, outputFile });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(inputFile, outputFile) {
  return spawnSync(process.execPath, [adapter, inputFile, outputFile], { cwd: root, encoding: "utf8" });
}

test("adapts canonical Rish provenance without promoting any control gate", () => {
  withFixture({}, () => {}, ({ observation, inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.equal(result.status, 0, result.stderr);
    const evidence = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    const recordHash = observation.rish_record.sha256;
    assert.equal(evidence.source.control_origin, "physical_android");
    assert.equal(evidence.delivery.sequence, 93);
    assert.equal(evidence.delivery.operation_id, `observed-broccoli-rish-${recordHash}`);
    assert.equal(evidence.delivery.status, "NOT_PROVEN");
    assert.equal(evidence.visible_acknowledgement.status, "NOT_PROVEN");
    assert.equal(evidence.semantic_effect.status, "NOT_PROVEN");
    assert.equal(evidence.reconnect_continuity.status, "NOT_PROVEN");
    assert.equal(evidence.declared_status, "NOT_PROVEN");
    assert.equal(evidence.r2, "NOT_PROVEN");

    const verified = spawnSync(process.execPath, [verifier, outputFile], { cwd: root, encoding: "utf8" });
    assert.equal(verified.status, 0, verified.stderr);
    assert.equal(JSON.parse(verified.stdout).live_acceptance, false);
  });
});

test("rejects a noncanonical wrapper repository or path", () => {
  for (const wrapper of [{ repository: "copied/repo" }, { path: "rish.sh" }]) {
    withFixture({ wrapper }, () => {}, ({ inputFile, outputFile }) => {
      const result = run(inputFile, outputFile);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /canonical wrapper must be onnxscibroccoli\/broccoli-core:lib\/rish_run\.sh/);
    });
  }
});

test("rejects wrapper provenance without exact Git commit and blob identities", () => {
  for (const wrapper of [{ commit_sha: "not-a-sha" }, { blob_sha: "not-a-sha" }]) {
    withFixture({ wrapper }, () => {}, ({ inputFile, outputFile }) => {
      const result = run(inputFile, outputFile);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /wrapper (commit_sha|blob_sha) has invalid format/);
    });
  }
});

test("requires RISH_PRESERVE_ENV=0", () => {
  withFixture({ wrapper: { rish_preserve_env: "1" } }, () => {}, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /RISH_PRESERVE_ENV must equal 0/);
  });
});

test("rejects record identity that differs from the observation source", () => {
  withFixture({}, (observation) => { observation.source.session_id = "other-session"; }, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /record identity does not match observation source/);
  });
});

test("requires the verified Android shell execution boundary", () => {
  for (const execution of [{ uid: 1000 }, { selinux_context: "u:r:untrusted_app:s0" }, { exit_code: 1 }]) {
    withFixture({ execution }, () => {}, ({ inputFile, outputFile }) => {
      const result = run(inputFile, outputFile);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /successful uid=2000 shell boundary/);
    });
  }
});

test("rejects a tampered Rish record", () => {
  withFixture({}, (observation, _record, dir) => {
    fs.appendFileSync(path.join(dir, observation.rish_record.path), "tampered\n");
  }, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Rish record (byte count|digest) mismatch/);
  });
});

test("rejects an input that is not observation-only", () => {
  withFixture({}, (observation) => { observation.observation_only = false; }, ({ inputFile, outputFile }) => {
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /observation_only must be true/);
  });
});

test("refuses to overwrite existing evidence", () => {
  withFixture({}, () => {}, ({ inputFile, outputFile }) => {
    fs.writeFileSync(outputFile, "preserve-me\n");
    const result = run(inputFile, outputFile);
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(outputFile, "utf8"), "preserve-me\n");
  });
});
