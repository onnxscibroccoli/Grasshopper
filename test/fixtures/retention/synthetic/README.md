# Synthetic Backup Retention Fixtures

**SYNTHETIC ONLY.** These fixtures are for unit tests and the local
`scripts/check-backup-retention.mjs` validator. They are **not** live
Claim B evidence and **do not** constitute live 14-day retention proof.

- No AWS, systemd, or production storage is involved.
- No secrets are present (`encryption_key_id` is a placeholder label).
- Every manifest has `synthetic: true` and `fixture_kind: "synthetic"`.

## Layout

| Path | Purpose |
|------|---------|
| `points/01.json` … `points/14.json` | Individual recovery-point manifests (`fixture_id` 1..14) |
| `manifests-14.json` | JSON array of all 14 points (positive for `check-backup-retention.mjs`) |
| `manifests-insufficient.json` | 13 points (negative: below minimum) |
| `manifests-duplicate-ids.json` | ≥14 entries with duplicate `backup_id`s so unique count < 14 (negative) |

## Timestamp formula

Fixed `NOW = 2026-09-26T12:00:00Z`. Point N is:

```
created_at = NOW - (N - 1) * 86400000 + 3600000
```

so each point sits one hour inside its day boundary relative to NOW and
all fourteen fall inside the 14-day retention window when evaluated at NOW.

## Usage

```bash
node scripts/check-backup-retention.mjs \
  test/fixtures/retention/synthetic/manifests-14.json \
  2026-09-26T12:00:00Z
```
