import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { ControlPlane } from '../src/control-plane.mjs';
import { TransactionalStateStore } from '../src/transactional-state-store.mjs';

const worker = fileURLToPath(new URL('./fixtures/transactional-task-worker.mjs', import.meta.url));

function awaitMessage(child, type) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => settle(new Error('worker timeout: ' + type)), 15000);
    function onMessage(m) { if (m?.type === type) settle(null, m); }
    function onError(err) { settle(err); }
    function onExit(code) { settle(new Error('worker exited before ' + type + ': ' + code)); }
    function settle(error, result) {
      clearTimeout(timeout);
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
      if (error) reject(error);
      else resolve(result);
    }
    child.on('message', onMessage);
    child.on('error', onError);
    child.on('exit', onExit);
  });
}

test('two independent processes cannot dispatch the same operation twice with a transactional store',
  { timeout: 25000 }, async t => {
    const dir = await mkdtemp(join(tmpdir(), 'grasshopper-operation-reserve-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const path = join(dir, 'state.sqlite');
    const effects = join(dir, 'external-effects.jsonl');
    const init = new TransactionalStateStore(path);
    await init.update(s => { s.agents.agent = { id: 'agent', state: 'ready' }; });
    init.close();
    const children = ['a', 'b'].map(name => fork(worker, [path, effects, name], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execArgv: []
    }));
    t.after(() => children.forEach(child => child.kill()));
    await Promise.all(children.map(child => awaitMessage(child, 'ready')));
    const outcomes = children.map(child => awaitMessage(child, 'finished'));
    children.forEach(child => child.send({ type: 'release' }));
    const finished = await Promise.all(outcomes);
    assert.equal(new Set(finished.map(x => x.taskId)).size, 1);

    const effectsLog = (await readFile(effects, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(effectsLog.length, 1, 'external effect dispatched by only one owner');
    const persistedStore = new TransactionalStateStore(path);
    t.after(() => persistedStore.close());
    const state = await persistedStore.load();
    assert.equal(Object.keys(state.tasks).length, 1);
    assert.equal(state.tasks[finished[0].taskId].state, 'completed');
  });

test('lease has a concrete owner, generation, fencing token and expiry', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-lease-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new TransactionalStateStore(join(dir, 'state.sqlite'));
  t.after(() => store.close());
  const plane = new ControlPlane(store, {
    async start() { return { executionId: 'held', result: null }; }
  });
  const task = await plane.createTask({ id: 'task-1', operationKey: 'op-1', command: 'hold: work', agentId: 'agent' });
  assert.equal(task.lease.operation_id, 'op-1');
  assert.equal(task.lease.owner_id, plane.ownerId);
  assert.equal(task.lease.generation, 1);
  assert.ok(task.lease.fencing_token.startsWith('fence_'));
  assert.ok(task.lease.expires_at > Date.now());
  assert.equal(task.lease.lease_status, 'active');
});

test('rotating fencing token and generation causes stale completion callback to be discarded', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-rotating-lease-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new TransactionalStateStore(join(dir, 'state.sqlite'));
  t.after(() => store.close());
  let complete;
  const plane = new ControlPlane(store, {
    async start(_task, callback) {
      complete = callback;
      return { executionId: 'held', result: null };
    }
  });
  await plane.createTask({ id: 'task-1', operationKey: 'op-1', command: 'hold: work', agentId: 'agent' });
  await store.update(s => {
    s.tasks['task-1'].lease.generation += 1;
    s.tasks['task-1'].lease.fencing_token = 'replacement-token';
    s.tasks['task-1'].lease.owner_id = 'replacement-owner';
  });
  await complete({ code: 0, signal: null, stdout: '', stderr: '', completion: 'confirmed' });
  const final = await store.load();
  assert.equal(final.tasks['task-1'].state, 'running');
  assert.equal(final.tasks['task-1'].finishedAt, undefined);
  assert.equal(final.events.filter(e => e.type === 'task.finished').length, 0);
});

test('expired lease cannot authorize completion or cancellation', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-expired-lease-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new TransactionalStateStore(join(dir, 'state.sqlite'));
  t.after(() => store.close());
  let complete;
  let cancelled = 0;
  const plane = new ControlPlane(store, {
    async start(_task, callback) {
      complete = callback;
      return { executionId: 'held', result: null };
    },
    async cancel() { cancelled++; return { acknowledged: true }; }
  });
  await plane.createTask({ id: 'task-1', operationKey: 'op-1', command: 'hold: work', agentId: 'agent' });
  await store.update(s => { s.tasks['task-1'].lease.expires_at = Date.now() - 1; });
  assert.deepEqual(await plane.cancelTask('task-1'), {
    acknowledged: false, reason: 'not_current_execution_owner'
  });
  assert.equal(cancelled, 0);
  await complete({ code: 0, signal: null, stdout: '', stderr: '', completion: 'confirmed' });
  assert.equal((await store.load()).tasks['task-1'].state, 'running');
  await plane.reconcile();
  assert.equal((await store.load()).tasks['task-1'].state, 'orphaned');
});
