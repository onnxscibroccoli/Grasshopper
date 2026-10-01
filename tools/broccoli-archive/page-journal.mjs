/**
 * Crash-safe page journal for Broccoli chat archive.
 * Atomic commit model: write temp → fsync → rename → update checkpoint.
 * Never holds the entire archive in RAM.
 *
 * Target durable root on Android: /sdcard/OmniKali/broccoli/archive-journal/
 * On remote workers: configurable path.
 */

import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, rename, access } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_ROOT = process.env.BROCCOLI_ARCHIVE_ROOT || './archive-journal';

function sha256(data) {
  return createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');
}

export class PageJournal {
  constructor(root = DEFAULT_ROOT) {
    this.root = root;
    this.pagesDir = join(root, 'pages');
    this.checkpointPath = join(root, 'checkpoint.json');
  }

  async ensure() {
    await mkdir(this.pagesDir, { recursive: true });
  }

  async readCheckpoint() {
    try {
      const raw = await readFile(this.checkpointPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return { last_page_id: -1, last_hash: null, updated_at: null };
    }
  }

  async commitPage(pageId, messages, source = 'unknown') {
    await this.ensure();
    const page = {
      page_id: pageId,
      checkpoint_id: `ckpt-${pageId}`,
      messages,
      committed_at: new Date().toISOString(),
      page_hash: '',
      source,
    };
    page.page_hash = sha256(page);

    const tmp = join(this.pagesDir, `page-${pageId}.json.tmp`);
    const final = join(this.pagesDir, `page-${pageId}.json`);

    await writeFile(tmp, JSON.stringify(page, null, 2), 'utf8');
    await rename(tmp, final); // atomic on same filesystem

    const ckpt = {
      last_page_id: pageId,
      last_hash: page.page_hash,
      updated_at: page.committed_at,
      source,
    };
    const ckptTmp = this.checkpointPath + '.tmp';
    await writeFile(ckptTmp, JSON.stringify(ckpt, null, 2), 'utf8');
    await rename(ckptTmp, this.checkpointPath);

    return page;
  }

  async resumeFrom() {
    const ckpt = await this.readCheckpoint();
    return ckpt.last_page_id + 1;
  }

  async verifyPage(pageId) {
    const path = join(this.pagesDir, `page-${pageId}.json`);
    const raw = await readFile(path, 'utf8');
    const page = JSON.parse(raw);
    const expected = page.page_hash;
    const copy = { ...page, page_hash: '' };
    const actual = sha256(copy);
    return { ok: actual === expected, pageId, expected, actual };
  }
}

// CLI smoke
if (import.meta.url === `file://${process.argv[1]}`) {
  const j = new PageJournal();
  const next = await j.resumeFrom();
  console.log(JSON.stringify({ next_page: next, checkpoint: await j.readCheckpoint() }, null, 2));
}
