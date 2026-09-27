import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { cutoffForRetention, validateRecoverySet, validateManifest } from "../lib/independent-backup-policy.mjs";

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

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "backup-retention");

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
  const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "check-backup-retention.mjs");
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
