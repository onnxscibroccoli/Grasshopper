import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const script = path.join(root, "scripts/cloud-android/admit-arm64-userdebug-builder.mjs");
const profile = path.join(root, "environments/cloud-android-arm64-userdebug-build.json");

function snapshot(overrides = {}) {
  return {
    schema: "grasshopper.builder-snapshot/v1",
    architecture: "aarch64",
    logical_cpus: 8,
    memory_total_bytes: 40 * 1024 ** 3,
    memory_available_bytes: 32 * 1024 ** 3,
    workspace_free_bytes: 350 * 1024 ** 3,
    load_1m: 1,
    qemu_processes: 0,
    lease_hours: 24,
    checkpoint_path: "/build/checkpoints",
    ...overrides,
  };
}

function run(value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-builder-admission-"));
  const file = path.join(dir, "snapshot.json");
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
  const result = spawnSync(process.execPath, [script, "evaluate", profile, file], {
    cwd: root,
    encoding: "utf8",
  });
  fs.rmSync(dir, { recursive: true, force: true });
  return result;
}

test("admits a clean isolated builder only as simulated evidence", () => {
  const result = run(snapshot());
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "PASS");
  assert.equal(report.evidence_source, "SIMULATED");
  assert.deepEqual(report.failures, []);
});

test("blocks a builder while any QEMU guest is running", () => {
  const result = run(snapshot({ qemu_processes: 1 }));
  assert.equal(result.status, 75);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "BLOCKED");
  assert.ok(report.failures.includes("active_qemu_processes"));
});

test("blocks insufficient RAM and workspace capacity", () => {
  const result = run(snapshot({
    memory_total_bytes: 11 * 1024 ** 3,
    memory_available_bytes: 5 * 1024 ** 3,
    workspace_free_bytes: 47 * 1024 ** 3,
  }));
  assert.equal(result.status, 75);
  const report = JSON.parse(result.stdout);
  assert.ok(report.failures.includes("memory_total_bytes"));
  assert.ok(report.failures.includes("memory_available_bytes"));
  assert.ok(report.failures.includes("workspace_free_bytes"));
});

test("blocks insufficient CPU and overloaded hosts", () => {
  const result = run(snapshot({ logical_cpus: 2, load_1m: 2 }));
  assert.equal(result.status, 75);
  const report = JSON.parse(result.stdout);
  assert.ok(report.failures.includes("logical_cpus"));
  assert.ok(report.failures.includes("load_1m"));
});

test("blocks missing checkpoints and an unbounded lease", () => {
  const result = run(snapshot({ lease_hours: 72, checkpoint_path: "" }));
  assert.equal(result.status, 75);
  const report = JSON.parse(result.stdout);
  assert.ok(report.failures.includes("lease_hours"));
  assert.ok(report.failures.includes("checkpoint_path"));
});
