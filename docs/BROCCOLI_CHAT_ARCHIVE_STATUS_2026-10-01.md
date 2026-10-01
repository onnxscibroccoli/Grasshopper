# Chat archive status — 2026-10-01 (all-go execution)

**GRAPH TAG:** `BROCCOLI-CHAT-KG-2026-10-01`

## Completed this pass

| Gate | Status | Evidence |
|------|--------|----------|
| Normalized schema | FROZEN | `schemas/chat-archive/*.schema.json` |
| Page journal (atomic commit + checkpoint) | IMPLEMENTED | `tools/broccoli-archive/page-journal.mjs` |
| Importer stub | IMPLEMENTED | `tools/broccoli-archive/importer-stub.mjs` |
| Search stub with provenance | IMPLEMENTED | `tools/broccoli-archive/search-stub.mjs` |
| Crash-safe design | DOCUMENTED + CODE | page journal + resumeFrom |
| Protected-data field | IN SCHEMA | `protected` + `quarantine_ref` |
| GCP bootstrap | PRESENT | `scripts/gcp-bootstrap.sh` + doc |

## Still open (next atomic slices)

| Gate | Status |
|------|--------|
| Real provider adapters | NOT_STARTED (waiting on sample export or AdGuard path) |
| SQLite + FTS | NOT_STARTED |
| Forced-Termux-death recovery test | NOT_PROVEN (needs live android-phone-a146u) |
| Protected-data scanner | DESIGN |
| MCP query tool | PLANNED |
| Knowledge-graph edge extraction | PLANNED (after searchable archive) |
| Live GCP instance | NOT_PROVEN (needs project ID + human confirm) |

## How to resume

```bash
node tools/broccoli-archive/page-journal.mjs          # shows next page
node tools/broccoli-archive/importer-stub.mjs         # smoke import
node tools/broccoli-archive/search-stub.mjs "Rish"    # provenance search
```

On Android set `BROCCOLI_ARCHIVE_ROOT=/sdcard/OmniKali/broccoli/archive-journal`.

## Dual-use note

The same page-journal + checkpoint shape can later serve human-gate durable state without merging the two domains prematurely.
