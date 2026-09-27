# Backup retention synthetic fixtures

**SYNTHETIC ONLY.** These JSON fixtures exercise
`validateRecoverySet` / `scripts/check-backup-retention.mjs` from
`lib/independent-backup-policy.mjs`.

They do **not** authorize production backup runs, AWS mutation, or closing
the live `backup_retention` gate.

## Ownership (Wave256 atoms)

| Ids | Owner atom | Scope |
|-----|------------|--------|
| 1–7 | W256 B5 | base synthetic pack (minimum path) |
| 8–14 | W256 B6 | base synthetic pack (complete ≥14 set) |
| **15–21** | **W256 G13** | **extended edge-case pack (this directory ships 15–21)** |

## Standing rules

- Synthetic PASS (meetsMinimum true) ≠ live backup_retention COMPLETE.
- Gate still needs ≥14 **live** independently restorable points; verified live
  evidence may remain 1. **Never claim live 14** from these fixtures.
- No secrets, connection strings, cookies, or tokens in fixtures.
- Fixture `artifact_sha256` values are deterministic hex placeholders, not
  hashes of real database dumps.

## Fixture file shape

Each `NN-*.json` file:

```json
{
  "id": 15,
  "title": "short-name",
  "synthetic": true,
  "never_claim_live_14": true,
  "now": "2026-09-27T12:00:00.000Z",
  "expected": {
    "meetsMinimum": true,
    "retainedCount": 15,
    "uniqueRecoveryPointCount": 15
  },
  "backups": [ /* manifest-shaped objects for validateRecoverySet */ ]
}
```

Run: `npm run test:independent-backup-policy`
