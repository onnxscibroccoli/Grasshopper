import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

function run(command, cwd, timeoutMs = 15000) {
  return new Promise((resolvePromise, reject) => {
    const p = spawn('/bin/sh', ['-lc', command], { cwd, detached: true });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-p.pid, 'SIGKILL'); } catch { p.kill('SIGKILL'); }
    }, timeoutMs);
    p.stdout.on('data', d => stdout += d);
    p.stderr.on('data', d => stderr += d);
    p.on('error', reject);
    p.on('close', code => {
      clearTimeout(timer);
      resolvePromise({ exitCode: timedOut ? 124 : code, stdout, stderr, timedOut });
    });
  });
}

export async function createHumanCheckpoint({ broccoliRoot, goal, step, reason, hits, nodes }) {
  const id = randomUUID();
  const dir = resolve(broccoliRoot, '.cache', 'omnikali-human-gates');
  const path = resolve(dir, `${id}.json`);
  const screenshot = `/sdcard/Download/OmniKali/human-gates/${id}.png`;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path, JSON.stringify({
    schema: 'omnikali.human-gate/v1',
    id,
    status: 'WAITING_FOR_HUMAN',
    goal,
    step,
    reason,
    hits,
    nodes,
    screenshot,
    createdAt: new Date().toISOString(),
  }, null, 2));
  await run(
    `RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(`mkdir -p /sdcard/Download/OmniKali/human-gates && screencap -p ${screenshot}`)}`,
    broccoliRoot,
    15000,
  );
  await run(
    `termux-notification --id ${JSON.stringify(`omnikali-human-${id}`)} --ongoing --priority high --title ${JSON.stringify('OmniKali: human action required')} --content ${JSON.stringify(reason)} --image-path ${JSON.stringify(screenshot)}`,
    broccoliRoot,
    10000,
  );
  return { id, path, screenshot };
}

export async function clearHumanNotification(id, broccoliRoot) {
  await run(`termux-notification-remove ${JSON.stringify(`omnikali-human-${id}`)}`, broccoliRoot, 10000);
}

export async function waitForHuman({ snapshot, checkpoint, detectHumanBoundary, timeoutMs = 300000 }) {
  const deadline = Date.now() + timeoutMs;
  let clearCount = 0;
  while (Date.now() < deadline) {
    const current = await snapshot();
    const hits = detectHumanBoundary(current.nodes);
    if (hits.length === 0 && current.nodes.length > 0) clearCount += 1;
    else clearCount = 0;
    if (clearCount >= 2) return { status: 'RESUMED', snapshot: current, checkpoint };
    await new Promise(resolvePromise => setTimeout(resolvePromise, 2000));
  }
  return { status: 'WAITING_FOR_HUMAN', checkpoint };
}
