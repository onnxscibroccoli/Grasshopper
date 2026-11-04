import { TransactionalStateStore } from '../../src/transactional-state-store.mjs';

const [path, owner] = process.argv.slice(2);
if (!path || !owner || !process.send) throw new Error('IPC, database path and owner required');
const store = new TransactionalStateStore(path);
const watchdog = setTimeout(() => process.exit(2), 12000);
watchdog.unref();
try {
  // Both independent processes load before either begins its write transaction.
  await store.load();
  process.send({ type: 'loaded', owner });
  await new Promise(resolve => process.on('message', m => { if (m?.type === 'release') resolve(); }));
  await store.update(state => {
    state.events.push({ type: 'transactional.write', at: new Date().toISOString(), data: { owner } });
  });
  process.send({ type: 'saved', owner });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  store.close();
}
