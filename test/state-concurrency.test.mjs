import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { StateStore } from '../src/store.mjs';
import { emptyState } from '../src/model.mjs';
import { ControlPlane } from '../src/control-plane.mjs';
import { DeterministicExecutor } from '../src/executor.mjs';

const childScript = fileURLToPath(new URL('./fixtures/file-store-race-worker.mjs', import.meta.url));

function waitForMessage(child, expected, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('worker timed out: ' + expected)), timeout);
    function cleanup() {
      clearTimeout(timer);
      child.off('message', onMessage);
      child.off('error', onError);
      child.off('exit', onExit);
    }
    function finish(error, value) {
      cleanup();
      if (error) reject(error);
      else resolve(value);
    }
    function onMessage(message) {
      if (message?.type === expected) finish(null, message);
    }
    function onError(error) { finish(error); }
    function onExit(code) { finish(new Error('worker exited before ' + expected + ': ' + code)); }
    child.on('message', onMessage);
    child.on('error', onError);
    child.on('exit', onExit);
  });
}

test('NEGATIVE CONTROL: two independent file-store writers lose one committed update', { timeout: 20000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-race-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'state.json');
  const store = new StateStore(path);
  await store.save(emptyState());

  const children = ['worker-a', 'worker-b'].map(owner =>
    fork(childScript, [path, owner], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      execArgv: []
    })
  );
  t.after(() => children.forEach(child => child.kill()));

  // Register the barriers before allowing the children to proceed.
  await Promise.all(children.map(child => waitForMessage(child, 'loaded')));
  const saved = children.map(child => waitForMessage(child, 'saved'));
  children.forEach(child => child.send({ type: 'release' }));
  await Promise.all(saved);

  const state = await store.load();
  const committed = state.events.filter(item => item.type === 'adversarial.write');
  assert.equal(committed.length, 1,
    'legacy read/modify/save overwrites a peer write; upgrade this to an invariant test when transactional persistence ships');
  assert.equal(new Set(committed.map(item => item.data.owner)).size, 1);
});

test('NEGATIVE CONTROL: a delayed completion can finalize an orphaned task without a fencing token', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-fencing-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new StateStore(join(dir, 'state.json'));
  let complete;
  const executor = {
    async start(_task, callback) {
      complete = callback;
      return { executionId: 'controlled-execution', result: null };
    }
  };
  const plane = new ControlPlane(store, executor);
  const task = await plane.createTask({
    id: 'fencing-task',
    operationKey: 'fencing-op',
    agentId: 'local-agent',
    command: 'hold: fencing'
  });
  assert.equal(task.state, 'running');
  await plane.reconcile(-1000);
  assert.equal((await store.load()).tasks[task.id].state, 'orphaned');
  await complete({ code: 0, signal: null, stdout: '', stderr: '', completion: 'confirmed' });
  assert.equal((await store.load()).tasks[task.id].state, 'completed',
    'known defect: no active generation/lease is checked on completion');
});

test('existing duplicate callback is idempotent for a single in-process task', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-duplicate-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new StateStore(join(dir, 'state.json'));
  let complete;
  const plane = new ControlPlane(store, {
    async start(_task, callback) {
      complete = callback;
      return { executionId: 'fixed-execution', result: null };
    }
  });
  await plane.createTask({ id: 'single-task', agentId: 'agent', command: 'hold: callback' });
  const result = { code: 0, signal: null, stdout: '', stderr: '', completion: 'confirmed' };
  await complete(result);
  await complete(result);
  const state = await store.load();
  assert.equal(state.tasks['single-task'].state, 'completed');
  assert.equal(state.events.filter(event => event.type === 'task.finished').length, 1);
});

test('orphan temporary file does not replace a previously committed snapshot', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-atomicity-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, 'state.json');
  const store = new StateStore(path);
  const initial = emptyState();
  initial.agents.a = { id: 'a', name: 'retained' };
  await store.save(initial);
  await writeFile(path + '.tmp-99999', '{truncated', 'utf8');
  const restored = await store.load();
  assert.equal(restored.agents.a.name, 'retained');
  // This checks visibility after a partially written staging file,
  // not durability across power loss (the old implementation does not fsync).
});

test('sequential duplicate task identity returns the same record', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'grasshopper-dedup-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const plane = new ControlPlane(new StateStore(join(dir, 'state.json')), new DeterministicExecutor());
  const input = { operationKey: 'same-op', agentId: 'local', command: 'ok: once' };
  const first = await plane.createTask(input);
  const second = await plane.createTask(input);
  assert.equal(first.id, second.id);
});
