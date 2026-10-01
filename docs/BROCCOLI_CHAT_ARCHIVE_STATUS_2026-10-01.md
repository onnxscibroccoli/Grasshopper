# Chat archive status - 2026-10-01

GRAPH TAG: BROCCOLI-CHAT-KG-2026-10-01

## Recovered historical evidence

The earlier broccoli-core main tree at e8eff12 contains a real archive implementation in tools/broccoli_conv_archive.py. It used compressed JSONL conversation artifacts plus SQLite conv/lookup tables, SHA-256 deduplication, Grok inbox ingestion, and /sdcard/Broccoli/pull bundle ingestion.

The earlier runtime also contains provider-neutral Account(account_id, provider, availability, cooldown) scheduling in runtime/account_pool.py and a staged chat harvest pipeline in modules/chat_harvest.py, chat_reader.py, chat_store.py.

This changes the evidence state from NOT_RECOVERED to RECOVERED_HISTORICAL for the existence and broad shape of the older archive. It does not prove that provider-complete export ingestion was ever finished.

## Current implementation

| Gate | Status | Evidence |
|------|--------|----------|
| Normalized account/conversation/message schema | FROZEN | schemas/chat-archive/*.schema.json |
| Historical archive recovery | PROVEN_HISTORICAL | broccoli-core tools/broccoli_conv_archive.py |
| Provider-neutral account model | PROVEN_HISTORICAL | broccoli-core runtime/account_pool.py |
| Crash-safe page journal | IMPLEMENTED | tools/broccoli-archive/page-journal.mjs |
| Durable STARTED/COMMITTED journal | IMPLEMENTED | page-journal journal.jsonl |
| Historical/generic import adapter | IMPLEMENTED | tools/broccoli-archive/historical-import.mjs |
| SQLite + FTS derived index | IMPLEMENTED | tools/broccoli-archive/sqlite-index.py |
| Protected-data scanner/quarantine | IMPLEMENTED | sqlite-index.py, searchable text excluded |
| Provenance | IMPLEMENTED | provider/account/conversation/message/page/source hash |
| Smoke test | IMPLEMENTED | tools/broccoli-archive/smoke-test.mjs |
| Provider-complete adapters | NOT_PROVEN | ChatGPT mapping supported; Grok historical text supported; Gemini/Claude native exports not yet verified |
| Forced-Termux-death recovery | NOT_PROVEN | needs live android-phone-a146u |
| MCP query tool | PLANNED | next integration slice |
| Knowledge-graph edge extraction | PLANNED | derived after searchable archive acceptance |

## Recovery model

Raw committed pages remain authoritative. SQLite/FTS can be deleted and rebuilt. A page is written to a temporary file, atomically renamed, then the checkpoint is atomically updated. journal.jsonl records STARTED and COMMITTED states.

Android durable root:
/sdcard/OmniKali/broccoli/archive-journal

Historical compatibility input:
/sdcard/Broccoli/pull

The SD-card/shared-storage path is a durable checkpoint surface, not RAM. Page size must be benchmarked on the live phone.

## Next gates

1. Run the smoke test on a clean checkout.
2. Add a benign forced-Termux-kill test around a multi-page import.
3. Benchmark shared-storage page sizes on android-phone-a146u.
4. Add MCP query/search with mandatory provenance.
5. Add graph ingestion from indexed records.
6. Add provider adapters one at a time with export fixtures and explicit evidence.
