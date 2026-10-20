import test from 'node:test';
import assert from 'node:assert/strict';
import { executePhoneAction } from '../src/android/phone-action-hook.mjs';

const base = { device_id: 'c1f33361d8d5412ba44cb8653f33025b', tool: 'run_phone_command', argv: ['id'], mutating: false, request_id: 'req-hook-0001' };
for (const env of [{ ...base, tool: 'unknown' }, { ...base, argv: ['reboot'], mutating: true }, { ...base, argv: ['sh', '-c', 'id'] }, { ...base, argv: ['dumpsys', 'battery', 'reset'] }]) {
  test(`no dispatch for ${env.tool} ${env.argv}`, async () => {
    let calls = 0;
    const result = await executePhoneAction(env, { dispatch: async () => { calls++; } });
    assert.equal(calls, 0);
    assert.equal(result.dispatched, false);
    assert.notEqual(result.decision, 'Allow');
    assert.equal(result.request_id, env.request_id);
  });
}
test('allowed envelope is copied, frozen, and dispatched exactly once', async () => {
  const input = structuredClone(base);
  let calls = 0;
  const result = await executePhoneAction(input, { dispatch: async env => {
    calls++;
    input.argv[0] = 'reboot';
    assert.deepEqual(env, base);
    assert.ok(Object.isFrozen(env));
    assert.ok(Object.isFrozen(env.argv));
    return { exitCode: 0, output: 'uid=2000(shell)' };
  } });
  assert.equal(calls, 1);
  assert.equal(result.decision, 'Allow');
  assert.equal(result.outcome, 'RETURNED');
  assert.equal(result.request_id, base.request_id);
  assert.equal(result.result.exitCode, 0);
});
test('dispatch failure is indeterminate and never retried', async () => {
  let calls = 0;
  const result = await executePhoneAction(base, { dispatch: async () => { calls++; throw new Error('transport lost'); } });
  assert.equal(calls, 1);
  assert.equal(result.outcome, 'COMMAND_OUTCOME_UNKNOWN');
  assert.equal(result.request_id, base.request_id);
  assert.equal(result.dispatched, true);
});
test('missing dispatch blocks without granting an executable decision', async () => {
  const result = await executePhoneAction(base);
  assert.equal(result.decision, 'Block');
  assert.equal(result.dispatched, false);
});
test('malformed input cannot dispatch', async () => {
  const result = await executePhoneAction(null, { dispatch: () => assert.fail('must not dispatch') });
  assert.equal(result.decision, 'Block');
  assert.equal(result.dispatched, false);
});
