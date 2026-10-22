import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectInstalled } from '../src/app-inspect.mjs';

test('installed APK package validation is fail-closed', async () => {
  await assert.rejects(() => inspectInstalled({ broccoliRoot:'.', packageName:'bad/package' }), /INVALID_ANDROID_PACKAGE/);
});