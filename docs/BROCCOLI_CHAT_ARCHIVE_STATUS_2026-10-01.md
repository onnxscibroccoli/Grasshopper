# Chat archive status - 2026-10-01

GRAPH TAG: BROCCOLI-CHAT-KG-2026-10-01

## Recovered historical evidence

The earlier broccoli-core main tree at e8eff12 contains a real archive implementation in tools/broccoli_conv_archive.py. It used compressed JSONL conversation artifacts plus SQLite conv/lookup tables, SHA-256 deduplication, Grok inbox ingestion, and /sdcard/Broccoli/pull bundle ingestion.

The earlier runtime also contains provider-neutral Account(account_id, provider, availability, cooldown) scheduling in runtime/account_pool.py and a staged chat harvest pipeline in modules/chat_harvest.py, chat_reader.py, chat_store.py.

Evidence state is now RECOVERED_HISTORICAL for the existence and broad shape of the older archive. Provider-complete export ingestion was not proven.

## Current implementation

| Gate | Status | Evidence |
|------|--------|----------|
| Normalized account/conversation/message schema | FROZEN | schemas/chat-archive/*.schema.json |
| Historical archive recovery | PROVEN_HISTORICAL | broccoli-core tools/broccoli_conv_archive.py |
| Provider-neutral account model | PROVEN_HISTORICAL | broccoli-core runtime/account_pool.py |
| Crash-safe page journal | IMPLEMENTED + LIVE_SMOKE_PASS | tools/broccoli-archive/page-journal.mjs |
| Durable STARTED/COMMITTED journal | IMPLEMENTED | page-journal journal.jsonl |
| Orphan-page recovery after checkpoint lag | LIVE_PASS | resumeFrom verified a valid page beyond checkpoint |
| Historical/generic import adapter | IMPLEMENTED | tools/broccoli-archive/historical-import.mjs |
| SQLite + FTS derived index | IMPLEMENTED + LIVE_SMOKE_PASS | tools/broccoli-archive/sqlite-index.py |
| Protected-data scanner/quarantine | IMPLEMENTED + LIVE_SMOKE_PASS | one protected smoke message excluded from FTS |
| Provenance | IMPLEMENTED | provider/account/conversation/message/page/source hash |
| Smoke test | LIVE_PASS | tools/broccoli-archive/smoke-test.mjs |
| Android shared-storage benchmark | OBSERVED | docs/ANDROID_ARCHIVE_STORAGE_BENCHMARK_2026-10-01.md |
| Forced-Termux-death recovery | NOT_PROVEN | am force-stop from an RDC child did not terminate the RDC child; caller/process boundary remains to be isolated |
| MCP query tool | PLANNED | next integration slice |
| Knowledge-graph edge extraction | PLANNED | derived after searchable archive acceptance |

## Storage benchmark

On android-phone-a146u, fsync write measurements were approximately:

- native Termux cache: 4 MiB file at 58.88 MB/s; 16 MiB at 132.07 MB/s
- /sdcard/OmniKali shared storage: 4 MiB at 51.29 MB/s; 16 MiB at 122.38 MB/s

Shared storage is durable storage, not RAM. Initial target is approximately 4 MiB maximum page payload once byte-bounded page construction is implemented.

## Recovery model

Raw committed pages remain authoritative. SQLite/FTS can be deleted and rebuilt. A page is written to a temporary file, atomically renamed, then the checkpoint is atomically updated. journal.jsonl records STARTED and COMMITTED states. On resume, valid orphan page files beyond the checkpoint are verified and advanced instead of overwritten.

Android durable root:
/sdcard/OmniKali/broccoli/archive-journal

Historical compatibility input:
/sdcard/Broccoli/pull

## Next gates

1. Add byte-bounded page construction around the measured 4 MiB target.
2. Isolate the real Android Termux process boundary and perform a benign forced-kill recovery test.
3. Add MCP query/search with mandatory provenance.
4. Add graph ingestion from indexed records.
5. Add provider adapters one at a time with export fixtures and explicit evidence.
