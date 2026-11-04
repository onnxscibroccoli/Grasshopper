// Opt-in transactional backend for the Grasshopper reference control plane.
// Node.js >=22.16 supplies DatabaseSync (experimental in Node 22).
// The legacy JSON store is not silently migrated or overwritten.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { emptyState, now } from './model.mjs';

function assertSnapshot(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) ||
      state.version !== 1 || !Array.isArray(state.events)) {
    throw new Error('invalid version-1 state snapshot');
  }
  for (const key of ['agents', 'resources', 'tasks', 'locks']) {
    if (!state[key] || typeof state[key] !== 'object' || Array.isArray(state[key])) {
      throw new Error('invalid state snapshot section: ' + key);
    }
  }
  return state;
}

function rejectAsync(value) {
  if (value != null && typeof value.then === 'function') {
    throw new TypeError('transactional update callbacks must be synchronous');
  }
}

export class StaleStateRevisionError extends Error {
  constructor() {
    super('stale state revision: reload and reconcile before retry');
    this.name = 'StaleStateRevisionError';
  }
}

export class TransactionalStateStore {
  #revisions = new WeakMap();

  constructor(path, { busyTimeoutMs = 5000 } = {}) {
    if (typeof path !== 'string' || !path || path === ':memory:') {
      throw new TypeError('an explicit on-disk SQLite path is required');
    }
    if (!Number.isInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 60000) {
      throw new TypeError('invalid busy timeout');
    }
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path, { timeout: busyTimeoutMs });
    try {
      this.db.exec('PRAGMA journal_mode=WAL');
      this.db.exec('PRAGMA synchronous=FULL');
      this.db.exec('PRAGMA foreign_keys=ON');
      this.db.exec('CREATE TABLE IF NOT EXISTS state_snapshots (id INTEGER PRIMARY KEY CHECK (id=1), revision INTEGER NOT NULL CHECK (revision>=1), payload TEXT NOT NULL)');
    } catch (error) {
      this.db.close();
      throw error;
    }
  }

  #row() {
    return this.db.prepare('SELECT revision, payload FROM state_snapshots WHERE id=1').get();
  }

  #put(state, revision) {
    assertSnapshot(state);
    this.db.prepare(
      'INSERT INTO state_snapshots(id, revision, payload) VALUES(1, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, payload=excluded.payload'
    ).run(revision, JSON.stringify(state));
  }

  async load() {
    const row = this.#row();
    const state = row ? assertSnapshot(JSON.parse(row.payload)) : emptyState();
    this.#revisions.set(state, row?.revision ?? 0);
    return state;
  }

  // Unlike the legacy file store, load()/save() alone is compare-and-swap:
  // saving a stale version fails rather than overwriting another process.
  async save(state) {
    assertSnapshot(state);
    const expected = this.#revisions.get(state) ?? 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.#row()?.revision ?? 0;
      if (current !== expected) throw new StaleStateRevisionError();
      state.updatedAt = now();
      this.#put(state, current + 1);
      this.db.exec('COMMIT');
      this.#revisions.set(state, current + 1);
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // All mutators see a single serialized snapshot, even across processes.
  // A callback must be purely synchronous: do not call network/device APIs
  // or await inside a SQLite write transaction.
  async update(fn) {
    if (typeof fn !== 'function') throw new TypeError('update requires a function');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.#row();
      const state = row ? assertSnapshot(JSON.parse(row.payload)) : emptyState();
      rejectAsync(fn(state));
      state.updatedAt = now();
      const nextRevision = (row?.revision ?? 0) + 1;
      this.#put(state, nextRevision);
      this.db.exec('COMMIT');
      this.#revisions.set(state, nextRevision);
      return state;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  // Explicit, one-way bootstrap. The old JSON file stays untouched.
  // The operator must stop legacy writers before importing; otherwise
  // independent databases could diverge after migration.
  async importLegacySnapshot(legacyPath) {
    if (typeof legacyPath !== 'string' || !legacyPath) {
      throw new TypeError('legacy snapshot path is required');
    }
    if (legacyPath === this.path) throw new Error('legacy and SQLite paths must differ');
    const original = await readFile(legacyPath, 'utf8');
    const parsed = assertSnapshot(JSON.parse(original));
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.#row()) throw new Error('refusing to import over an existing SQLite snapshot');
      this.#put(parsed, 1);
      this.db.exec('COMMIT');
      this.#revisions.set(parsed, 1);
      return parsed;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}
