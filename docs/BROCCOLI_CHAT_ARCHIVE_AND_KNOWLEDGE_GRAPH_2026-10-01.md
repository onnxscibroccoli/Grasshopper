# Broccoli searchable cross-provider AI chat archive + knowledge graph

**GRAPH TAG:** `BROCCOLI-CHAT-KG-2026-10-01`  
**Priority:** highest for human accessibility and reproducibility  
**Issue:** Grasshopper #118  
**Philosophy:** atomic, Unix-style, collector emits evidence / reasoner decides / executor acts. Raw source remains authoritative. Graph is derived.

## Why this is first

Chat interfaces become messy under bugs, multi-account work, and long sessions. A durable, searchable, provenance-preserving archive lets any human (organized or not) ask "where did I say X?" across every provider and account, then follow the graph to related decisions, code, machines, and experiments.

Human-gate and APK/Morphe work continue in parallel only when a solution is dual-use; they are not blockers for this path.

## Core invariants (never violate)

1. Raw conversation exports are the source of truth. Indexes and the knowledge graph are derived and disposable.
2. Never commit raw chats or protected material to Git.
3. Every search result carries provenance: provider → account → conversation → message (and optional project link).
4. Protected data (tokens, passwords, private URLs, PII, financial) is quarantined; the graph may keep an opaque reference only.
5. Android Termux can be killed by the OS. All ingestion is crash-safe via bounded paging to durable storage.
6. Provider-neutral from day one. Adapters convert native exports into one normalized schema.
7. Atomic commits only. One page, one schema, one importer at a time.

## Normalized hierarchy (identity first)

```
archive/
  accounts/
    <account-id>/
      account.json                 # provider, display name, created, last-seen
      providers/
        <provider-id>/             # openai | xai | google | anthropic | …
          conversations/
            <conversation-id>/
              conversation.json    # title, created, updated, source-hash
              messages/
                <message-id>.json # role, content, timestamp, attachments-ref
              attachments/
          projects/                # optional metadata layer, not identity
            <project-id>/
              project.json
              conversation-links.json
  manifests/
  indexes/                         # SQLite + FTS, semantic vectors later
  checkpoints/
  quarantine/                      # protected material stays here
```

Fundamental identity:

```
provider → account → conversation → message
```

Projects are metadata edges, never the primary key of a conversation.

## Pipeline (reproducible for anyone)

```
RAW EXPORT (provider native or AdGuard / browser export)
    ↓
protection scan
    ├─ normal → normalized JSON pages
    └─ protected → quarantine + opaque ref
    ↓
append-only page journal (bounded, atomic commit)
    ↓
checkpoint + resume token
    ↓
SQLite + FTS index
    ↓
semantic / embedding index (optional later)
    ↓
knowledge graph (concepts, decisions, repos, machines, bugs)
    ↓
AI query interface ("where did I first talk about Rish transport?")
```

Example answer shape:

```
ChatGPT
  Account: account-A
  Project: OmniKali (link only)
  Conversation: "Broccoli transport debugging"
  Message: 184
  Source: original export hash

Grok
  Account: account-B
  Conversation: "Android automation"
  Message: 73
  Source: original export hash
```

## Crash-safe Android paging (Termux kill domain)

Observed failure mode: Android kills Termux, not RDC timeout.

```
AI export / harvest
    ↓
small bounded page (size to be benchmarked on android-phone-a146u)
    ↓
/sdcard/OmniKali/broccoli/archive-journal/
    ↓
atomic commit (rename or fsync + journal entry)
    ↓
checkpoint file (last committed page id + hash)
    ↓
next page
```

On restart (Termux:Boot or supervisor):

1. read checkpoint
2. verify committed pages
3. resume at next page
4. never re-hold the entire archive in RAM

Worker and supervisor are separate processes so a kill of the worker does not lose the recovery contract.

## Fastest implementation sequence (atomic gates)

1. Confirm or recreate historical schema (AdGuard scripts / old harvest not recovered → NOT_RECOVERED, recreate cleanly).
2. Freeze the normalized JSON schema (this document).
3. One provider importer (start with the easiest available export: Grok or ChatGPT text/JSON).
4. Page journal + forced-Termux-death recovery test (acceptance gate).
5. SQLite + FTS search with full provenance.
6. Minimal query CLI / MCP tool: "find X across my chats".
7. Protected-data scan before any broad indexing.
8. Derive knowledge-graph edges only after searchable archive is stable.

Do not wait for human-gate finalization or remote APK/Morphe worker. Those may share paging/checkpoint primitives later; they are not prerequisites.

## Reproducibility for any user

- Schema and importer code live in Grasshopper (or a small broccoli-archive package).
- Raw data stays on the user's durable storage (phone /sdcard, or remote worker disk).
- No Git of conversations.
- One command to resume: `broccoli-archive resume --checkpoint …`
- One command to search: `broccoli-archive search "Rish transport" --provenance`
- Documentation is the contract; code implements the contract; tests prove the contract.

## Status labels (strict)

| Item | Status |
|------|--------|
| Normalized schema | DESIGN + this doc |
| Historical AdGuard / export scripts | NOT_RECOVERED |
| Crash-safe page journal | DESIGN |
| One provider importer | NOT_STARTED |
| SQLite/FTS | NOT_STARTED |
| Knowledge graph derivation | PLANNED (after searchable archive) |
| Protected-data quarantine | DESIGN |
| Human query interface | PLANNED |

## Dual-use with other loops

- Checkpoint / resume / atomic page commit primitives are the same shape as human-gate checkpoints and remote worker job journals.
- Shared storage durability boundary (`/sdcard` or equivalent) is already the Broccoli durability model.
- Keep the implementations separate until a single primitive is proven useful in both places; then extract, do not merge prematurely.

## Next concrete actions

1. Add `schemas/chat-archive/` with JSON Schema for account / conversation / message.
2. Scaffold `src/archive/` or `tools/broccoli-archive/` with page journal and checkpoint.
3. Implement the first importer against a real export the user can supply.
4. Prove forced-Termux-kill recovery on android-phone-a146u.
5. Expose a minimal search MCP tool so any agent (or human) can query the archive.

Update this document and the knowledge graph after every material status change.
