/**
 * Provider-neutral importer stub.
 * Real adapters convert native exports → normalized messages, then feed PageJournal.
 * Start with the easiest export the user can supply.
 */

import { createHash } from 'node:crypto';
import { PageJournal } from './page-journal.mjs';

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

/**
 * Minimal text-line importer for smoke testing.
 * Each non-empty line becomes a message. Replace with real ChatGPT/Grok/Gemini adapters.
 */
export async function importTextLines(lines, {
  accountId = 'local-test',
  provider = 'other',
  conversationId = 'conv-smoke',
  pageSize = 50,
  source = 'text-lines',
} = {}) {
  const journal = new PageJournal();
  let pageId = await journal.resumeFrom();
  let batch = [];
  let msgIdx = 0;

  for (const line of lines) {
    const content = String(line).trim();
    if (!content) continue;

    const message = {
      message_id: `${conversationId}-m${msgIdx++}`,
      conversation_id: conversationId,
      role: msgIdx % 2 === 1 ? 'user' : 'assistant',
      timestamp: new Date().toISOString(),
      content,
      content_hash: sha256(content),
      protected: false,
      quarantine_ref: null,
      metadata: { account_id: accountId, provider },
    };
    batch.push(message);

    if (batch.length >= pageSize) {
      await journal.commitPage(pageId, batch, source);
      pageId += 1;
      batch = [];
    }
  }

  if (batch.length) {
    await journal.commitPage(pageId, batch, source);
  }

  return { pages_committed: pageId - (await journal.resumeFrom()) + 1, last_page: pageId };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = [
    'Where did I first talk about Rish transport?',
    'On the Android edge with Broccoli and Shizuku.',
    'We need crash-safe paging because Termux gets killed.',
  ];
  const result = await importTextLines(sample, { pageSize: 2 });
  console.log(JSON.stringify(result, null, 2));
}
