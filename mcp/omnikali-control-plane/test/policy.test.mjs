import test from 'node:test';
import assert from 'node:assert/strict';
import { authorize, toolClass } from '../src/policy.mjs';

test('safe tool requires token', () => {
  assert.equal(authorize('device.identity', { token: 'x', requiredToken: 'x' }), true);
  assert.throws(() => authorize('device.identity', { token: 'bad', requiredToken: 'x' }), /UNAUTHORIZED/);
});
test('mutating tool requires confirmation', () => {
  assert.throws(() => authorize('process.exec', { token: 'x', requiredToken: 'x' }), /CONFIRMATION_REQUIRED/);
  assert.equal(authorize('process.exec', { token: 'x', requiredToken: 'x', confirmation: true }), true);
});
test('unknown tools fail closed', () => assert.throws(() => authorize('anything', { token: 'x', requiredToken: 'x' }), /TOOL_NOT_ALLOWLISTED/));
test('classification is deterministic', () => { assert.equal(toolClass('fs.read'), 'SAFE'); assert.equal(toolClass('fs.write'), 'MUTATING'); assert.equal(toolClass('android.rish'), 'MUTATING'); assert.equal(toolClass('x'), 'DENIED'); });
test('arbitrary Rish commands require confirmation', () => { assert.throws(() => authorize('android.rish', { token:'x', requiredToken:'x' }), /CONFIRMATION_REQUIRED/); assert.equal(authorize('android.rish', { token:'x', requiredToken:'x', confirmation:true }), true); });
