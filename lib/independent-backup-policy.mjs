export const RETENTION_DAYS = 14;
export const MIN_RECOVERY_POINTS = 14;

export function cutoffForRetention(now, retentionDays = RETENTION_DAYS) {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) throw new Error("retentionDays must be >= 1");
  return new Date(now.getTime() - retentionDays * 86400000);
}

export function isRetained(createdAt, now, retentionDays = RETENTION_DAYS) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) throw new Error("invalid backup timestamp");
  return created >= cutoffForRetention(now, retentionDays);
}

export function validateRecoverySet(backups, now = new Date(), retentionDays = RETENTION_DAYS) {
  if (!Array.isArray(backups)) throw new Error("backups must be an array");
  const retained = backups.filter(b => isRetained(b.created_at, now, retentionDays));
  const uniqueIds = new Set(retained.map(b => b.backup_id).filter(Boolean));
  const oldest = retained.map(b => new Date(b.created_at)).sort((a, b) => a - b)[0] ?? null;
  const oldestAgeDays = oldest ? (now.getTime() - oldest.getTime()) / 86400000 : 0;
  return {
    retainedCount: retained.length,
    uniqueRecoveryPointCount: uniqueIds.size,
    oldestRetained: oldest?.toISOString() ?? null,
    oldestAgeDays,
    meetsMinimum: uniqueIds.size >= MIN_RECOVERY_POINTS
  };
}

export function validateManifest(manifest) {
  const required = [
    "backup_id","created_at","source_instance","postgres_version",
    "migration_revision","artifact_sha256","artifact_size","compression",
    "encryption_key_id"
  ];
  for (const key of required) {
    if (manifest[key] === undefined || manifest[key] === null || manifest[key] === "") {
      throw new Error(`manifest missing required field: ${key}`);
    }
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.artifact_sha256)) throw new Error("manifest artifact_sha256 must be SHA-256");
  if (!Number.isSafeInteger(manifest.artifact_size) || manifest.artifact_size < 1) throw new Error("manifest artifact_size must be a positive integer");
  return true;
}
