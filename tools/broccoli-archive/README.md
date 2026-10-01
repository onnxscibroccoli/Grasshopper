# broccoli-archive

Crash-safe, provider-neutral, provenance-preserving chat archive for the Broccoli knowledge graph.

## Quick smoke

```bash
node tools/broccoli-archive/importer-stub.mjs
node tools/broccoli-archive/search-stub.mjs Rish
node tools/broccoli-archive/page-journal.mjs
```

## Layout

- `page-journal.mjs` — atomic page commit + checkpoint/resume
- `importer-stub.mjs` — text-line smoke importer (replace with real provider adapters)
- `search-stub.mjs` — linear provenance search (SQLite/FTS next)

Durable root defaults to `./archive-journal`. On Android set:

```bash
export BROCCOLI_ARCHIVE_ROOT=/sdcard/OmniKali/broccoli/archive-journal
```

## Next gates

1. Real provider adapters (Grok / ChatGPT / Gemini export formats).
2. SQLite + FTS index.
3. Forced-Termux-kill recovery test.
4. Protected-data scanner before indexing.
5. MCP query tool.
