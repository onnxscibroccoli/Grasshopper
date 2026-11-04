import { appendFile } from 'node:fs/promises';
import { ControlPlane } from '../../src/control-plane.mjs';
import { TransactionalStateStore } from '../../src/transactional-state-store.mjs';

const [path, logPath, owner] = process.argv.slice(2);
if (!path || !logPath || !owner || !process.send) {
  throw new Error('requires database path, log path, owner and IPC');
}
const watchdog = setTimeout(() => process.exit(2), 15000);
watchdog.unref();
const store = new TransactionalStateStore(path);
try {
  process.send({ type: 'ready', owner });
  await new Promise(resolve => process.on('message', m => { if (m?.type === 'release') resolve(); }));
  const plane = new ControlPlane(store, {
    async start(task, callback) {
      await appendFile(logPath, JSON.stringify({ owner, operationKey: task.operationKey }) + '\n');
      const result = {
        code: 0, signal: null, stdout: '', stderr: '', completion: 'confirmed'
      };
      if (callback) await callback(result);
      return { executionId: 'execution-' + owner, operationKey: task.operationKey, result };
    }
  });
  const task = await plane.createTask({
    operationKey: 'shared-operation',
    agentId: 'agent',
    command: 'ok: one side effect'
  });
  process.send({ type: 'finished', owner, taskId: task.id });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  store.close();
}
