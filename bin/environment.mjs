#!/usr/bin/env node
import os from 'node:os';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { detectContext, validateProfile } from '../core/environment/context.mjs';

function property(name) {
  try { return execFileSync('/system/bin/getprop', [name], {encoding:'utf8', timeout:1000, stdio:['ignore','pipe','ignore']}).trim(); }
  catch { return ''; }
}
const sdk = Number(property('ro.build.version.sdk'));
const qemu = property('ro.kernel.qemu') || property('ro.boot.qemu');
const hardware = property('ro.hardware');
const facts = {
  platform: os.platform(), architecture: os.arch(), androidSdk: sdk,
  termux: process.execPath.startsWith('/data/data/com.termux/'),
  qemu: qemu === '1' ? true : qemu === '0' ? false : undefined,
  hardware: /^(ranchu|goldfish|android_x86)/.test(hardware) ? 'emulated' : undefined,
  oci: false,
};
// Physical identity is deliberately conservative: an Android runtime plus
// explicit non-QEMU evidence and a real hardware identifier are required.
if (sdk > 0 && qemu === '0' && hardware && facts.hardware !== 'emulated') facts.hardware = 'physical';
// Local metadata is an observation, not cloud API authorization. Never print it.
if (!sdk && os.platform() === 'linux') {
  try {
    const response = await fetch('http://169.254.169.254/opc/v2/instance/', {
      headers:{Authorization:'Bearer Oracle'}, signal:AbortSignal.timeout(1000), redirect:'error'
    });
    if (response.ok) {
      const metadata = await response.json();
      facts.oci = typeof metadata.id === 'string' && metadata.id.startsWith('ocid1.instance.') && typeof metadata.shape === 'string';
    }
  } catch {}
}
const context = detectContext(facts);
const profile = validateProfile(JSON.parse(await fs.readFile(new URL(`../config/environments/${context}.json`, import.meta.url), 'utf8')), context);
console.log(JSON.stringify({schema:'grasshopper.context-report/v1', capturedAt:new Date().toISOString(), context, facts, profile, liveControl:'NOT_PROVEN'}, null, 2));
if (context === 'unknown') process.exitCode = 78;
