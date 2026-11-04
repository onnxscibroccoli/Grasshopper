import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { emptyState } from '../src/model.mjs';
import { StaleStateRevisionError, TransactionalStateStore } from '../src/transactional-state-store.mjs';

const worker = fileURLToPath(new URL('./fixtures/transactional-store-worker.mjs', import.meta.url));

function messageFrom(child, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => settle(new Error('timeout awaiting ' + type)), 12000);
    const onMessage = msg => { if (msg?.type === type) settle(null, msg); };
    const onError = err => settle(err);
    const onExit = code => settle(new Error('worker exited (' + code + ') before ' + type));
    function settle(err, value) {
      clearTimeout(timer);
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
      if (err) reject(err);
      else resolve(value);
    }
    child.on('message', onMessage);
    child.on('error', onError);
    child.on('exit', onExit);
  });
}

test('independent SQLite WAL writers preserve both committed updates', { timeout: 20000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-sqlite-multiproc-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'state.sqlite');
  const init = new TransactionalStateStore(path);
  await init.save(emptyState());
  init.close();

  const children = ['a', 'b'].map(owner => fork(worker, [path, owner], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    execArgv: []
  }));
  t.after(() => children.forEach(child => child.kill()));
  await Promise.all(children.map(c => messageFrom(c, 'loaded')));
  const saved = children.map(c => messageFrom(c, 'saved'));
  children.forEach(c => c.send({ type: 'release' }));
  await Promise.all(saved);

  const store = new TransactionalStateStore(path);
  t.after(() => store.close());
  const persisted = (await store.load()).events.filter(e => e.type === 'transactional.write');
  assert.equal(persisted.length, 2);
  assert.deepEqual(persisted.map(e => e.data.owner).sort(), ['a', 'b']);
});

test('stale read/modify/save is rejected instead of overwriting a peer revision', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-sqlite-cas-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'state.sqlite');
  const first = new TransactionalStateStore(path);
  const second = new TransactionalStateStore(path);
  t.after(() => { first.close(); second.close(); });
  const older = await first.load();
  const stale = await second.load();
  older.agents.a = { id: 'a' };
  await first.save(older);
  stale.agents.b = { id: 'b' };
  await assert.rejects(() => second.save(stale), StaleStateRevisionError);
  const persisted = await first.load();
  assert.deepEqual(Object.keys(persisted.agents), ['a']);
});

test('failed synchronous update rolls back completely', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-sqlite-rollback-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new TransactionalStateStore(join(dir, 'state.sqlite'));
  t.after(() => store.close());
  await assert.rejects(() => store.update(s => {
    s.agents.leaked = { id: 'leaked' };
    throw new Error('simulated transaction failure');
  }), /simulated transaction failure/);
  assert.deepEqual((await store.load()).agents, {});
});

test('async callbacks cannot escape a SQLite write transaction', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-sqlite-async-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new TransactionalStateStore(join(dir, 'state.sqlite'));
  t.after(() => store.close());
  await assert.rejects(() => store.update(async state => {
    state.agents.invalid = { id: 'invalid' };
    await Promise.resolve();
  }), /must be synchronous/);
  assert.deepEqual((await store.load()).agents, {});
});

test('legacy import preserves bytes, event history and rejects a second import', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-sqlite-migration-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const legacyPath = join(dir, 'state.json');
  const legacy = emptyState();
  legacy.agents['agent-x'] = { id: 'agent-x', name: 'historical' };
  legacy.events.push({ id: 'evt-x', type: 'recorded', at: '2026-10-01T00:00:00Z', data: { value: 1 } });
  const original = JSON.stringify(legacy, null, 2) + '\n';
  await writeFile(legacyPath, original);
  const store = new TransactionalStateStore(join(dir, 'state.sqlite'));
  t.after(() => store.close());
  await store.importLegacySnapshot(legacyPath);
  assert.deepEqual(await store.load(), legacy);
  assert.equal(await readFile(legacyPath, 'utf8'), original);
  await assert.rejects(() => store.importLegacySnapshot(legacyPath), /existing SQLite snapshot/);
});

test('committed SQLite snapshot survives clean reopen', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-sqlite-restart-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'state.sqlite');
  const writer = new TransactionalStateStore(path);
  await writer.update(s => {
    s.tasks.task1 = { id: 'task1', state: 'orphaned' };
  });
  writer.close();
  const reader = new TransactionalStateStore(path);
  t.after(() => reader.close());
  assert.equal((await reader.load()).tasks.task1.state, 'orphaned');
});
