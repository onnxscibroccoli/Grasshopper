import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

function run(iface, mac, existing = false) {
  const dir = mkdtempSync(join(tmpdir(), 'cloud-net-'));
  try {
    mkdirSync(join(dir, 'bin'));
    mkdirSync(join(dir, 'net', iface), {recursive:true});
    writeFileSync(join(dir, 'net', iface, 'address'), mac);
    writeFileSync(join(dir, 'bin', 'ip'), '#!/bin/sh\necho "$*" >> "$IP_LOG"\nif [ "$*" = "rule show" ]; then printf "%s\\n" "$RULE_OUTPUT"; elif [ "$1" = "-o" ]; then printf "%s\\n" "$ADDR_OUTPUT"; fi\n', {mode:0o755});
    writeFileSync(join(dir, 'bin', 'sleep'), '#!/bin/sh\nexit 0\n', {mode:0o755});
    const result = spawnSync('sh', ['scripts/cloud-android/guest-network.sh'], {
      encoding:'utf8', env:{...process.env, PATH:join(dir,'bin')+':'+process.env.PATH,
      CLOUD_ANDROID_NET_ROOT:join(dir,'net'), CLOUD_ANDROID_NET_ATTEMPTS:'1',
      IP_LOG:join(dir,'calls'), ADDR_OUTPUT:existing ? '2: eth0 inet 10.0.2.15/24 scope global eth0' : '', RULE_OUTPUT:existing ? '18000: from all lookup main' : ''}});
    return {...result, calls: result.status === 0 ? readFileSync(join(dir,'calls'),'utf8') : ''};
  } finally {rmSync(dir,{recursive:true,force:true});}
}

test('renamed QEMU NIC gets IPv4 and Android policy route', () => {
  const r=run('wifi_eth','52:54:00:12:34:56');
  assert.equal(r.status,0,r.stderr);
  assert.match(r.calls,/addr add 10.0.2.15\/24 dev wifi_eth/);
  assert.match(r.calls,/route replace default via 10.0.2.2 dev wifi_eth/);
  assert.match(r.calls,/rule add priority 18000 lookup main/);
});
test('existing policy route is not duplicated on repeat execution', () => {
  const r=run('eth0','52:54:00:12:34:56',true);
  assert.equal(r.status,0,r.stderr);
  assert.doesNotMatch(r.calls,/rule add/);
  assert.doesNotMatch(r.calls,/addr add/);
});
test('unknown device identity fails without network mutations', () => {
  const r=run('wifi_eth','00:11:22:33:44:55');
  assert.equal(r.status,1);
  assert.match(r.stderr,/matching QEMU NIC absent/);
});
