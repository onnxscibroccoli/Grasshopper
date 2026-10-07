import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { detectContext, validateProfile } from '../core/environment/context.mjs';
import { evaluateAndroidAdmission as oldAdmission } from '../lib/cloud-android/admission.mjs';
import { evaluateAndroidAdmission } from '../core/cloud-android/admission.mjs';

test('verified contexts choose independent profiles', () => {
  assert.equal(detectContext({platform:'linux', oci:true}), 'oci-workstation');
  assert.equal(detectContext({androidSdk:35, termux:true, qemu:false, hardware:'physical'}), 'physical-android');
  assert.equal(detectContext({androidSdk:28, qemu:true}), 'cloud-android');
});
test('ambiguous, conflicting and hostname-only observations cannot select an executor', () => {
  for (const facts of [{hostname:'grasshopper-workstation'}, {androidSdk:35,termux:true}, {androidSdk:35,oci:true}, {}]) {
    assert.equal(detectContext(facts), 'unknown');
  }
});
test('profiles cannot activate commands and must match the detected identity', () => {
  for (const context of ['physical-android','cloud-android','oci-workstation','unknown']) {
    const profile = JSON.parse(fs.readFileSync(new URL(`../config/environments/${context}.json`, import.meta.url)));
    assert.equal(validateProfile(profile, context), profile);
    assert.throws(() => validateProfile({...profile,executeAutomatically:true}, context));
    assert.throws(() => validateProfile(profile, 'different-node'));
  }
});
test('legacy admission imports retain the exact implementation after the directory move', () => {
  assert.equal(oldAdmission, evaluateAndroidAdmission);
});
