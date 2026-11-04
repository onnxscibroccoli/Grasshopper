// Intentionally independent child process: cross-process races cannot be reproduced
// by running multiple async callbacks in one Node.js event loop.
import { StateStore } from '../../src/store.mjs';

const [path, owner] = process.argv.slice(2);
if (!path || !owner || !process.send) {
  throw new Error('expected IPC, state path, and owner');
}
const store = new StateStore(path);
let complete = false;
const watchdog = setTimeout(() => {
  console.error('worker timed out waiting for release');
  process.exit(2);
}, 10000);
watchdog.unref();

try {
  const snapshot = await store.load();
  process.send({ type: 'loaded', owner });
  await new Promise(resolve => {
    process.on('message', message => {
      if (message?.type === 'release') resolve();
    });
  });
  // Both children have independently loaded the same snapshot before release.
  snapshot.events.push({ type: 'adversarial.write', at: new Date().toISOString(), data: { owner } });
  await store.save(snapshot);
  complete = true;
  process.send({ type: 'saved', owner });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  if (!complete && process.exitCode == null) process.exitCode = 1;
}
