import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { cutoffForRetention, validateRecoverySet, validateManifest } from "../lib/independent-backup-policy.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures/retention/synthetic");
const FIXTURE_DIR = join(__dirname, "fixtures", "backup-retention");
const NOW = new Date("2026-09-26T12:00:00Z");

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

function validManifest(overrides = {}) {
  return {
    backup_id: "synthetic-backup-xx",
    created_at: "2026-09-26T13:00:00.000Z",
    source_instance: "synthetic-fixture-db",
    postgres_version: "17",
    migration_revision: "synthetic-0001",
    artifact_sha256: sha256("synthetic-backup-xx"),
    artifact_size: 1024,
    compression: "zstd",
    encryption_key_id: "synthetic-test-key",
    ...overrides,
  };
}

function loadFixturePack(minId, maxId) {
  const files = readdirSync(FIXTURE_DIR)
    .filter((name) => /^\d{2}-.+\.json$/.test(name))
    .sort();
  const fixtures = [];
  for (const name of files) {
    const doc = JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8"));
    if (doc.id >= minId && doc.id <= maxId) fixtures.push({ name, doc });
  }
  return fixtures;
}

// --- existing positives ---

test("retention requires fourteen recovery points inside the fourteen-day window", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const backups = Array.from({length:14}, (_,i) => ({backup_id:`backup-${i}`,created_at:new Date(now.getTime() - i*86400000 + 3600000).toISOString()}));
  const result = validateRecoverySet(backups, now);
  assert.equal(result.retainedCount, 14);
  assert.equal(result.uniqueRecoveryPointCount, 14);
  assert.equal(result.meetsMinimum, true);
});

test("a point older than the retention cutoff is excluded", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const backups = [{backup_id:"old",created_at:new Date(cutoffForRetention(now).getTime()-1).toISOString()}];
  const result = validateRecoverySet(backups, now);
  assert.equal(result.retainedCount, 0);
  assert.equal(result.meetsMinimum, false);
});

test("manifest validation rejects malformed checksums", () => {
  assert.throws(() => validateManifest({backup_id:"x",created_at:"2026-09-26T00:00:00Z",source_instance:"db",postgres_version:"16",migration_revision:"1",artifact_sha256:"bad",artifact_size:1,compression:"zstd",encryption_key_id:"key"}));
});

// --- negatives: validateRecoverySet ---

test("validateRecoverySet rejects non-array input", () => {
  assert.throws(() => validateRecoverySet(null, NOW), /backups must be an array/);
  assert.throws(() => validateRecoverySet({}, NOW), /backups must be an array/);
  assert.throws(() => validateRecoverySet("nope", NOW), /backups must be an array/);
});

test("fewer than 14 unique retained points fails meetsMinimum", () => {
  const backups = Array.from({ length: 13 }, (_, i) => ({
    backup_id: `backup-${i}`,
    created_at: new Date(NOW.getTime() - i * 86400000 + 3600000).toISOString(),
  }));
  const result = validateRecoverySet(backups, NOW);
  assert.equal(result.uniqueRecoveryPointCount, 13);
  assert.equal(result.meetsMinimum, false);
});

test("duplicate backup_ids fail meetsMinimum even when entry count >= 14", () => {
  const backups = Array.from({ length: 16 }, (_, i) => ({
    backup_id: `backup-${i % 10}`,
    created_at: new Date(NOW.getTime() - i * 86400000 + 3600000).toISOString(),
  }));
  const result = validateRecoverySet(backups, NOW);
  assert.ok(result.uniqueRecoveryPointCount < 14);
  assert.equal(result.meetsMinimum, false);
});

test("invalid timestamp throws", () => {
  assert.throws(
    () => validateRecoverySet([{ backup_id: "x", created_at: "not-a-date" }], NOW),
    /invalid backup timestamp/
  );
});

// --- negatives: validateManifest ---

test("manifest validation rejects missing or empty required fields", () => {
  const required = [
    "backup_id", "created_at", "source_instance", "postgres_version",
    "migration_revision", "artifact_sha256", "artifact_size", "compression",
    "encryption_key_id",
  ];
  for (const key of required) {
    assert.throws(() => validateManifest(validManifest({ [key]: undefined })), /missing required field/);
    assert.throws(() => validateManifest(validManifest({ [key]: null })), /missing required field/);
    if (key !== "artifact_size") {
      assert.throws(() => validateManifest(validManifest({ [key]: "" })), /missing required field/);
    }
  }
});

test("manifest validation rejects bad sha256", () => {
  assert.throws(() => validateManifest(validManifest({ artifact_sha256: "bad" })), /SHA-256/);
  assert.throws(() => validateManifest(validManifest({ artifact_sha256: "abcd" })), /SHA-256/);
  assert.throws(() => validateManifest(validManifest({ artifact_sha256: "g".repeat(64) })), /SHA-256/);
  assert.throws(() => validateManifest(validManifest({ artifact_sha256: "a".repeat(63) })), /SHA-256/);
});

test("manifest validation rejects artifact_size 0, negative, or float", () => {
  assert.throws(() => validateManifest(validManifest({ artifact_size: 0 })), /positive integer/);
  assert.throws(() => validateManifest(validManifest({ artifact_size: -1 })), /positive integer/);
  assert.throws(() => validateManifest(validManifest({ artifact_size: 1.5 })), /positive integer/);
});

test("valid synthetic-shaped manifest passes validateManifest", () => {
  assert.equal(validateManifest(validManifest()), true);
});

// --- fixture file loads (PR #48 canonical synthetic 01-14) ---

test("manifests-14.json meetsMinimum at NOW and every entry is synthetic", async () => {
  const manifests = JSON.parse(await readFile(join(FIXTURES, "manifests-14.json"), "utf8"));
  assert.equal(manifests.length, 14);
  const result = validateRecoverySet(manifests, NOW);
  assert.equal(result.meetsMinimum, true);
  assert.equal(result.uniqueRecoveryPointCount, 14);
  for (const m of manifests) {
    assert.equal(m.synthetic, true);
    assert.equal(m.fixture_kind, "synthetic");
    assert.equal(validateManifest(m), true);
  }
});

test("manifests-insufficient.json fails meetsMinimum", async () => {
  const manifests = JSON.parse(await readFile(join(FIXTURES, "manifests-insufficient.json"), "utf8"));
  assert.equal(manifests.length, 13);
  const result = validateRecoverySet(manifests, NOW);
  assert.equal(result.meetsMinimum, false);
});

test("manifests-duplicate-ids.json fails meetsMinimum", async () => {
  const manifests = JSON.parse(await readFile(join(FIXTURES, "manifests-duplicate-ids.json"), "utf8"));
  assert.ok(manifests.length >= 14);
  const result = validateRecoverySet(manifests, NOW);
  assert.ok(result.uniqueRecoveryPointCount < 14);
  assert.equal(result.meetsMinimum, false);
});

test("check-backup-retention.mjs PASS on manifests-14, FAIL on insufficient", () => {
  const script = join(__dirname, "../scripts/check-backup-retention.mjs");
  const nowArg = "2026-09-26T12:00:00Z";

  const pass = spawnSync(process.execPath, [script, join(FIXTURES, "manifests-14.json"), nowArg], {
    encoding: "utf8",
  });
  assert.equal(pass.status, 0, pass.stderr || pass.stdout);
  assert.match(pass.stdout, /"status":"PASS"/);

  const fail = spawnSync(process.execPath, [script, join(FIXTURES, "manifests-insufficient.json"), nowArg], {
    encoding: "utf8",
  });
  assert.equal(fail.status, 1, fail.stderr || fail.stdout);
  assert.match(fail.stdout, /"status":"FAIL"/);
});

// --- G13 pack already on main via #47 (backup-retention/ 15-21) ---

test("synthetic retention fixtures 15-21 match expected validateRecoverySet outcomes", () => {
  const fixtures = loadFixturePack(15, 21);
  assert.equal(fixtures.length, 7, "G13 pack must ship exactly fixtures 15-21");
  for (const { name, doc } of fixtures) {
    assert.equal(doc.synthetic, true, name);
    assert.equal(doc.never_claim_live_14, true, name);
    assert.match(doc.note ?? "", /SYNTHETIC FIXTURE/i, name);
    const result = validateRecoverySet(doc.backups, new Date(doc.now));
    assert.equal(result.meetsMinimum, doc.expected.meetsMinimum, `${name} meetsMinimum`);
    assert.equal(result.retainedCount, doc.expected.retainedCount, `${name} retainedCount`);
    assert.equal(
      result.uniqueRecoveryPointCount,
      doc.expected.uniqueRecoveryPointCount,
      `${name} uniqueRecoveryPointCount`
    );
  }
});

test("synthetic retention fixtures contain no secret-shaped payloads", () => {
  const fixtures = loadFixturePack(15, 21);
  const secretish = /AGENT_TOKEN|SecretString|AKIA[0-9A-Z]{16}|postgres:\/\/|password\s*=/i;
  for (const { name, doc } of fixtures) {
    const raw = JSON.stringify(doc);
    assert.equal(secretish.test(raw), false, name);
    for (const backup of doc.backups) {
      assert.match(backup.artifact_sha256, /^[a-f0-9]{64}$/i, name);
      assert.equal(backup.synthetic, true, name);
      assert.equal(backup.never_claim_live_14, true, name);
    }
  }
});

test("README marks fixtures synthetic and forbids live-14 claims", () => {
  const readme = readFileSync(join(FIXTURE_DIR, "README.md"), "utf8");
  assert.match(readme, /SYNTHETIC ONLY/i);
  assert.match(readme, /Never claim live 14/i);
  assert.match(readme, /15–21|15-21/);
});

test("check-backup-retention.mjs CLI agrees with fixture 15 and 17 expectations", () => {
  const script = join(__dirname, "..", "scripts", "check-backup-retention.mjs");
  for (const id of [15, 17]) {
    const files = readdirSync(FIXTURE_DIR).filter((n) => n.startsWith(String(id).padStart(2, "0") + "-"));
    assert.equal(files.length, 1, `fixture ${id}`);
    const doc = JSON.parse(readFileSync(join(FIXTURE_DIR, files[0]), "utf8"));
    const manifestsPath = join(FIXTURE_DIR, `.cli-${id}-manifests.json`);
    writeFileSync(manifestsPath, JSON.stringify(doc.backups));
    try {
      const run = spawnSync(process.execPath, [script, manifestsPath, doc.now], { encoding: "utf8" });
      const parsed = JSON.parse(run.stdout.trim());
      assert.equal(parsed.status, doc.expected.meetsMinimum ? "PASS" : "FAIL", `cli fixture ${id}`);
      assert.equal(run.status, doc.expected.meetsMinimum ? 0 : 1, `cli exit ${id}`);
    } finally {
      try { unlinkSync(manifestsPath); } catch {}
    }
  }
});
