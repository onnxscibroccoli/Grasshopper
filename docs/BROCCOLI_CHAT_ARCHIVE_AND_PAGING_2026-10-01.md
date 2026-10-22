# Broccoli Chat Archive and Crash-Resilient Paging Plan - 2026-10-01

## Purpose
Broccoli should become the durable ingestion and retrieval layer for the user's AI conversation history across providers and accounts.

The first useful product is a searchable corpus that answers: Where did I say or learn this, across any AI account, conversation, project, or provider?

Knowledge-graph construction sits on top of this corpus.

## Recovered historical intent
The current knowledge graph identifies a Broccoli local-memory layer as planned and states that a conversation index is not the source of truth.

Connected GitHub code search did not recover an older implementation containing the requested full-chat export schema, account/project hierarchy, or AdGuard scripts. Searches of broccoli-core, Grasshopper, OmniKali, omnikali-link, and GPTOmniKali-full-stack found no matching AdGuard source. The only current AdGuard hit is the installed Android package com.adguard.android.

Therefore the old implementation is NOT_RECOVERED, not declared nonexistent.

## Canonical archive hierarchy
archive/accounts/<account-id>/account.json
archive/accounts/<account-id>/providers/<provider-id>/conversations/<conversation-id>/conversation.json
archive/accounts/<account-id>/providers/<provider-id>/conversations/<conversation-id>/messages/<message-id>.json
archive/accounts/<account-id>/providers/<provider-id>/conversations/<conversation-id>/attachments/
archive/accounts/<account-id>/providers/<provider-id>/projects/<project-id>/project.json
archive/accounts/<account-id>/providers/<provider-id>/projects/<project-id>/conversation-links.json
archive/manifests/
archive/indexes/
archive/checkpoints/
archive/quarantine/

The canonical record identity is provider + account + conversation + message. Project membership is metadata, not a requirement for message identity.

## Normalized conversation record
Retain normalized fields plus the original provider payload.
Required metadata: provider, account identifier, provider conversation identifier, title, project/workspace identifier when present, created/updated timestamps, source export identifier, source file SHA-256, import timestamp, schema version, and original payload location.
Messages retain provider message identifier, parent/message-tree relationship, role, author identity when available, timestamp, normalized text, attachment references, source byte/range or source-object reference, content hash, and redaction/protection status.

The original export remains immutable. Normalized records are derived indexes.

## Search architecture
Phase 1: immutable raw exports, normalized SQLite, full-text search, deterministic metadata filters, and source links back to provider/account/conversation/message.
Phase 2: embeddings, entity extraction, topic clustering, cross-conversation relationships, and knowledge-graph edges.
The graph must never become the only copy of source conversation text.

## Protected-data boundary
Raw conversations can contain credentials, session tokens, private URLs, personal information, financial information, authentication artifacts, or other protected material.
Raw exports stay local/private by default. Never commit raw conversations to Git. Detect protected fields before indexing. Mark protected fields QUARANTINED. Graph nodes may store stable opaque references instead of sensitive content. Search results apply the same protection policy as ingestion. Derived summaries retain provenance without copying protected values unnecessarily.

## Android storage and paging
Use an append-only crash-safe journal on shared storage: /sdcard/OmniKali/broccoli/archive-journal/
Each unit is a small page named PAGE-<monotonic-sequence>-<sha256-prefix>.json.
Page fields: operation ID, source identifier, byte/object range, schema version, payload hash, state STARTED|COMMITTED|FAILED, timestamps, and resume token.
Commit sequence: write temporary page, fsync where supported, atomically rename to committed page, update small manifest/checkpoint, continue.
Never keep an entire export in RAM. Stream fixed-size chunks and persist a checkpoint after every committed page. Page size must be benchmarked on the actual device.

## Termux-death recovery
The observed interruption was Android killing the Termux process, not RDC timing out.
Recovery must exist outside the dying Termux process.
Use Termux:Boot for startup recovery, durable checkpoint/journal on shared storage, a single-instance lock, short bounded work pages, idempotent page commits, resume from last committed page, and notification/UI state RUNNING|PAUSED|RECOVERING|COMPLETE.
The supervisor cannot be the only recovery mechanism if it shares the same kill domain as the worker.

## SD-card clarification
On this device /sdcard is Android shared storage. It is useful as a durable paging/checkpoint surface, but it is not equivalent to RAM.
Target model: RAM for active page -> shared storage for durable page -> remote/cloud worker for heavy processing.

## Provider ingestion
Initial normalized provider identities: ChatGPT/OpenAI, Grok/xAI, Gemini/Google, Claude/Anthropic, and future providers.
The system must support multiple accounts per provider.
No provider-specific UI automation is required when an official export/API exists. UI automation is a fallback acquisition method and follows the human-gate contract.

## User-facing query layer
Examples: Where did I talk about Rish transport? Which conversation contained the APKTool idea? Show every discussion about Morphe. What did I decide about the OCI workstation? Find the conversation where we discovered the Termux process was being killed.
Every answer retains provenance: provider -> account -> project -> conversation -> message -> source artifact.

## Evidence state
PROVEN: Broccoli is the historical Android/Termux automation lineage. The current master graph records a planned local memory layer and says the conversation index is not the source of truth.
NOT_RECOVERED: exact older chat-export implementation, exact old account/project directory schema, exact old AdGuard scripts.
DESIGN_ONLY: normalized cross-provider archive, crash-safe paging, SQLite/FTS layer, knowledge-graph ingestion, protected-data quarantine, and provider adapters.