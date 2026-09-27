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
| `points/15.json` … `points/21.json` | Extended synthetic points (`fixture_id` 15..21; Wave256 G13) |
| `manifests-21.json` | JSON array of points 01–21 (synthetic extended pack; **not** live Claim B) |

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

## Extended pack (15–21)

Wave256 G13 owns `fixture_id` 15–21. Same timestamp formula and schema as 01–14.
Points 16–21 fall **outside** the 14-day window when evaluated at the fixed NOW
(by construction of the day-offset formula). Loading them proves synthetic
markers and schema only — **never cite as live 14 / Claim B**.

Depends on 01–14 from the base synthetic fixtures PR/branch.
