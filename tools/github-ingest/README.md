# GitHub repository ingest

This is the repository-scale counterpart to Broccoli chat paging.

## Why

The onnxscibroccoli account contains repositories ranging from small projects to multi-GB trees. The knowledge graph should not become a copy of those repositories. It needs a durable, searchable evidence index that can point an agent back to the exact repository, commit, and path.

## Model

\`GitHub repo -> partial clone -> commit/tree manifest -> path classification -> bounded text extraction -> SQLite/FTS -> knowledge-graph references\`

The source repository remains authoritative.

The local index records:
- repository
- ref and commit SHA
- path
- blob object SHA
- size
- classification
- bounded text when safe
- SHA-256 of indexed text

Protected-looking paths such as credentials, tokens, private keys, and \`.env\` files are not copied into the text index.

Large blobs are indexed as metadata only.

## Incremental behavior

The first sync uses:

\`git clone --filter=blob:none --no-checkout\`

Subsequent syncs fetch only Git metadata required to move the reference forward. Text blobs are fetched only for bounded, relevant files.

This avoids turning an agent investigation into a multi-GB memory/storage operation.

## Usage

\`\`\`bash
python3 tools/github-ingest/github_ingest.py sync onnxscibroccoli/broccoli-core
python3 tools/github-ingest/github_ingest.py sync onnxscibroccoli/Grasshopper
python3 tools/github-ingest/github_ingest.py search 'broccoli archive'
python3 tools/github-ingest/github_ingest.py status
\`\`\`

Default index:

\`~/.cache/omnikali/github-index\`

Override with:

\`OMNIKALI_GITHUB_INDEX_ROOT=/path/to/index\`

## Evidence boundary

This tool is an evidence index, not a source-of-truth replacement.

A search hit must resolve to:

\`repository -> commit -> path -> source\`

The knowledge graph should store the provenance reference and extracted conclusion, not an uncontrolled copy of the repository.

## Next integration

The archive/knowledge system should treat GitHub repository records and AI conversation records as two source families:

- \`source_family=github\`
- \`source_family=conversation\`

Both can feed the same provenance-aware search and graph layer.
