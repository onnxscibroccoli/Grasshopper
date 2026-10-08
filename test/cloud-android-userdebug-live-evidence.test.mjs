import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const collector = path.join(root, "scripts/cloud-android/collect-arm64-userdebug-builder.mjs");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-builder-live-"));
}

function writeProfile(dir, overrides = {}) {
  const profile = {
    schema: "grasshopper.android-build-profile/v1",
    id: "test-live-builder",
    resource_admission: {
      architecture: process.arch === "arm64" ? "aarch64" : process.arch,
      minimum_logical_cpus: 1,
      minimum_memory_total_bytes: 1,
      minimum_memory_available_bytes: 1,
      minimum_workspace_free_bytes: 1,
      maximum_load_per_logical_cpu: 100,
      maximum_qemu_processes: 0,
      maximum_lease_hours: 24,
      checkpoint_path_required: true,
      ...overrides,
    },
  };
  const file = path.join(dir, "profile.json");
  fs.writeFileSync(file, `${JSON.stringify(profile)}\n`);
  return file;
}

function runCollect(profile, dir, procRoot = "/proc") {
  const evidence = path.join(dir, "evidence.json");
  const checkpoint = path.join(dir, "checkpoints");
  fs.mkdirSync(checkpoint);
  const result = spawnSync(process.execPath, [
    collector,
    "collect",
    profile,
    dir,
    checkpoint,
    "1",
    evidence,
    procRoot,
  ], { cwd: root, encoding: "utf8" });
  return { result, evidence };
}

test("live collection writes digest-bound evidence that verifies", () => {
  const dir = tempDir();
  try {
    const profile = writeProfile(dir);
    const { result, evidence } = runCollect(profile, dir);
    assert.ok([0, 75].includes(result.status), result.stderr);
    const record = JSON.parse(fs.readFileSync(evidence, "utf8"));
    assert.equal(record.schema, "grasshopper.builder-admission-evidence/v1");
    assert.equal(record.evidence_source, "LIVE");
    assert.equal(record.admission.status, result.status === 0 ? "PASS" : "BLOCKED");
    assert.equal(typeof record.snapshot.process_scan_complete, "boolean");
    assert.match(record.integrity.evidence_set_sha256, /^[a-f0-9]{64}$/);

    const verify = spawnSync(process.execPath, [collector, "verify", profile, evidence], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(verify.status, 0, verify.stderr);
    assert.match(verify.stdout, /PASS arm64_userdebug_builder_live_evidence/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("collector identifies QEMU by executable instead of diagnostic command text", () => {
  const dir = tempDir();
  try {
    const procRoot = path.join(dir, "proc");
    fs.mkdirSync(path.join(procRoot, "101"), { recursive: true });
    fs.mkdirSync(path.join(procRoot, "102"), { recursive: true });
    fs.symlinkSync("/usr/bin/qemu-system-aarch64", path.join(procRoot, "101", "exe"));
    fs.symlinkSync("/usr/bin/bash", path.join(procRoot, "102", "exe"));
    fs.writeFileSync(path.join(procRoot, "102", "cmdline"), "grep qemu-system-aarch64");
    const profile = writeProfile(dir);
    const { result, evidence } = runCollect(profile, dir, procRoot);
    assert.equal(result.status, 75, result.stderr);
    const record = JSON.parse(fs.readFileSync(evidence, "utf8"));
    assert.equal(record.snapshot.qemu_processes, 1);
    assert.deepEqual(record.snapshot.qemu_pids, [101]);
    assert.ok(record.admission.failures.includes("active_qemu_processes"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ambiguous process visibility blocks live admission", () => {
  const dir = tempDir();
  try {
    const procRoot = path.join(dir, "proc");
    fs.mkdirSync(path.join(procRoot, "201", "exe"), { recursive: true });
    const profile = writeProfile(dir);
    const { result, evidence } = runCollect(profile, dir, procRoot);
    assert.equal(result.status, 75, result.stderr);
    const record = JSON.parse(fs.readFileSync(evidence, "utf8"));
    assert.equal(record.snapshot.process_scan_complete, false);
    assert.ok(record.admission.failures.includes("process_scan_ambiguous"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("verification rejects evidence after snapshot tampering", () => {
  const dir = tempDir();
  try {
    const profile = writeProfile(dir);
    const { result, evidence } = runCollect(profile, dir);
    assert.ok([0, 75].includes(result.status), result.stderr);
    const record = JSON.parse(fs.readFileSync(evidence, "utf8"));
    record.snapshot.logical_cpus += 1;
    fs.writeFileSync(evidence, `${JSON.stringify(record)}\n`);
    const verify = spawnSync(process.execPath, [collector, "verify", profile, evidence], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(verify.status, 0);
    assert.match(verify.stderr, /snapshot digest mismatch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("verification rejects relabeled simulated evidence", () => {
  const dir = tempDir();
  try {
    const profile = writeProfile(dir);
    const { result, evidence } = runCollect(profile, dir);
    assert.ok([0, 75].includes(result.status), result.stderr);
    const record = JSON.parse(fs.readFileSync(evidence, "utf8"));
    record.admission.evidence_source = "SIMULATED";
    record.integrity.admission_sha256 = crypto
      .createHash("sha256")
      .update(JSON.stringify(record.admission))
      .digest("hex");
    fs.writeFileSync(evidence, `${JSON.stringify(record)}\n`);
    const verify = spawnSync(process.execPath, [collector, "verify", profile, evidence], {
      cwd: root,
      encoding: "utf8",
    });
    assert.notEqual(verify.status, 0);
    assert.match(verify.stderr, /LIVE evidence required/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
