import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceManifest, sourceById } from '../src/morphe.mjs';

test('morphe manifest has explicit evidence labels', () => {
  const m = sourceManifest();
  assert.equal(m.sources.length, 3);
  assert.ok(m.sources.every(s => s.upstream && s.fork && s.trust && s.evidence));
  assert.equal(sourceById('hoodles').fork, 'onnxscibroccoli/morphe-patches');
});

test('unverified source cannot be represented as verified', () => {
  const s = sourceById('alastor');
  assert.equal(s.trust, 'REPO_VERIFIED_BUILDABLE_NOT_SIGNATURE_VERIFIED');
});
