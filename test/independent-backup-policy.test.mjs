import test from "node:test";
import assert from "node:assert/strict";
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
