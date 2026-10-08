import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const script = path.join(root, "scripts/cloud-android/verify-arm64-userdebug-builder-candidates.mjs");
const profile = path.join(root, "environments/cloud-android-arm64-userdebug-build.json");
const inventory = path.join(root, "docs/ARM64_USERDEBUG_BUILDER_CANDIDATES.json");
const schema = path.join(root, "schemas/grasshopper-builder-candidate-inventory-v1.schema.json");

function run(file, command = "verify") {
  return spawnSync(process.execPath, [script, command, profile, file], {
    cwd: root,
    encoding: "utf8",
  });
}

function withInventory(value, action) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-builder-candidates-"));
  const file = path.join(dir, "inventory.json");
  fs.writeFileSync(file, `${JSON.stringify(value)}\n`);
  try {
    return action(file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function baseInventory(candidate) {
  return {
    schema: "grasshopper.builder-candidate-inventory/v1",
    observed_utc: "2026-10-08T14:53:39Z",
    build_authorized: false,
    overall_status: "LIVE_COLLECTION_CANDIDATE",
    candidates: [candidate],
  };
}

function passingStaticCandidate(overrides = {}) {
  return {
    id: "clean-arm64",
    provider: "provider-neutral",
    protected: false,
    paid_capacity_authorized: false,
    access_status: "VERIFIED",
    identity_status: "VERIFIED",
    evidence_source: "READ_ONLY_STATIC",
    declared_status: "ELIGIBLE_FOR_LIVE_COLLECTION",
    snapshot: {
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
    },
    ...overrides,
  };
}

test("current no-paid candidate inventory verifies without authorizing a build", () => {
  const result = run(inventory);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /overall=NO_ELIGIBLE_NODE/);
  assert.match(result.stdout, /build_authorized=false/);
});

test("static passing capacity is only eligible for later live collection", () => {
  const value = baseInventory(passingStaticCandidate());
  withInventory(value, (file) => {
    const result = run(file, "evaluate");
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.overall_status, "LIVE_COLLECTION_CANDIDATE");
    assert.equal(report.build_authorized, false);
    assert.equal(report.candidates[0].status, "ELIGIBLE_FOR_LIVE_COLLECTION");
  });
});

test("inventory rejects any direct build authorization claim", () => {
  const value = baseInventory(passingStaticCandidate());
  value.build_authorized = true;
  withInventory(value, (file) => {
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /build_authorized must remain false/);
  });
});

test("protected nodes remain excluded even when resources appear sufficient", () => {
  const candidate = passingStaticCandidate({
    id: "protected-base",
    provider: "AWS",
    protected: true,
    declared_status: "EXCLUDED_PROTECTED",
  });
  const value = baseInventory(candidate);
  value.overall_status = "NO_ELIGIBLE_NODE";
  withInventory(value, (file) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("unverified identity cannot become a live-collection candidate", () => {
  const candidate = passingStaticCandidate({
    id: "unknown-endpoint",
    access_status: "TIMEOUT",
    identity_status: "NOT_PROVEN",
    declared_status: "UNQUALIFIED_IDENTITY",
  });
  const value = baseInventory(candidate);
  value.overall_status = "NO_ELIGIBLE_NODE";
  withInventory(value, (file) => {
    const result = run(file, "evaluate");
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.candidates[0].status, "UNQUALIFIED_IDENTITY");
    assert.equal(report.overall_status, "NO_ELIGIBLE_NODE");
  });
});

test("a missing node that requires provisioning remains excluded", () => {
  const candidate = passingStaticCandidate({
    id: "provider-without-node",
    access_status: "NO_AUTHORIZED_NODE",
    identity_status: "NOT_PROVEN",
    requires_new_provisioning: true,
    declared_status: "EXCLUDED_PROVISIONING_REQUIRED",
  });
  const value = baseInventory(candidate);
  value.overall_status = "NO_ELIGIBLE_NODE";
  withInventory(value, (file) => {
    const result = run(file);
    assert.equal(result.status, 0, result.stderr);
  });
});

test("candidate inventory schema validates the checked-in matrix", () => {
  const result = spawnSync(process.execPath, [
    path.join(root, "scripts/validate-json-schema-subset.mjs"),
    schema,
    inventory,
  ], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SCHEMA OK grasshopper\.builder-candidate-inventory\/v1/);
});

test("candidate inventory schema rejects undeclared candidate fields", () => {
  const value = baseInventory(passingStaticCandidate({ unexpected: true }));
  withInventory(value, (file) => {
    const result = spawnSync(process.execPath, [
      path.join(root, "scripts/validate-json-schema-subset.mjs"),
      schema,
      file,
    ], { cwd: root, encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /candidates\/0\/unexpected: additional property is not allowed/);
  });
});

test("repository command deterministically verifies schema and candidate policy", () => {
  const result = spawnSync("npm", ["run", "verify:cloud-android-userdebug-candidates"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SCHEMA OK grasshopper\.builder-candidate-inventory\/v1/);
  assert.match(result.stdout, /overall=NO_ELIGIBLE_NODE build_authorized=false/);
});
