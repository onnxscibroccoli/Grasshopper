/**
 * Minimal provenance-aware search stub.
 * Later: SQLite FTS + optional semantic layer.
 * For now: linear scan of committed pages (fine for smoke / small archives).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PageJournal } from './page-journal.mjs';

export async function search(query, { root } = {}) {
  const journal = new PageJournal(root);
  await journal.ensure();
  const files = (await readdir(journal.pagesDir))
    .filter((f) => f.startsWith('page-') && f.endsWith('.json'))
    .sort();

  const q = query.toLowerCase();
  const hits = [];

  for (const f of files) {
    const page = JSON.parse(await readFile(join(journal.pagesDir, f), 'utf8'));
    for (const msg of page.messages || []) {
      if (msg.protected) continue; // never surface quarantined content
      const text = (msg.content || '').toLowerCase();
      if (text.includes(q)) {
        hits.push({
          provider: msg.metadata?.provider || 'unknown',
          account_id: msg.metadata?.account_id || 'unknown',
          conversation_id: msg.conversation_id,
          message_id: msg.message_id,
          role: msg.role,
          snippet: (msg.content || '').slice(0, 240),
          page_id: page.page_id,
          source_hash: page.page_hash,
        });
      }
    }
  }

  return { query, hit_count: hits.length, hits };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const q = process.argv[2] || 'Rish';
  const result = await search(q);
  console.log(JSON.stringify(result, null, 2));
}
