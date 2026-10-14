import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const project = resolve(fileURLToPath(new URL('../', import.meta.url)));
const gate = resolve(project, 'scripts/cloud-android/oci-redroid-admission.sh');

function run(mode) {
  return spawnSync('bash', [gate, mode], {
    cwd: project,
    encoding: 'utf8',
    timeout: 20_000,
    maxBuffer: 64 * 1024,
    env: { ...process.env, LC_ALL: 'C' },
  });
}

test('Redroid admission gate is valid bash and rejects unexpected modes', () => {
  const syntax = spawnSync('bash', ['-n', gate], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  const bad = run('not-a-command');
  assert.equal(bad.status, 3, bad.stderr);
  assert.match(bad.stderr, /Usage:/);
});

test('Redroid admission gate emits a parseable, fail-closed machine report', () => {
  for (const mode of ['preflight', 'status']) {
    const r = run(mode);
    assert.ok([0, 2].includes(r.status), `Unexpected status ${r.status}: ${r.stderr}`);
    const d = JSON.parse(r.stdout);
    assert.equal(d.schema, 'grasshopper.redroid.admission/v1');
    assert.equal(d.mode, mode);
    assert.ok(['PASS', 'BLOCKED'].includes(d.status));
    assert.ok(Array.isArray(d.checks));
    assert.ok(d.checks.length >= 2);
    for (const check of d.checks) {
      assert.match(check.name, /^[a-z0-9_]+$/);
      assert.ok(['PASS', 'BLOCKED'].includes(check.result));
    }
    assert.equal(d.status === 'PASS', r.status === 0);
    assert.equal(d.checks.some(c => c.result === 'BLOCKED'), r.status === 2);
    if (mode === 'preflight') {
      assert.ok(d.checks.some(c => c.name.startsWith('character_device_') || c.name.startsWith('missing_character_device_')));
    }
  }
});
