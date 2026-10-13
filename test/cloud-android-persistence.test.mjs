import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const script = path.resolve(process.cwd(), 'scripts/cloud-android/persistent-device.sh');

test('cloud Android script exists and is executable', () => {
  const st = fs.statSync(script);
  assert.ok((st.mode & 0o111) !== 0);
});

test('cloud Android defaults to loopback and token-gated presentation', () => {
  const body = fs.readFileSync(script, 'utf8');
  assert.match(body, /set -Eeuo pipefail/);
  assert.match(body, /CLOUD_ANDROID_LISTEN_ADDR:-127\.0\.0\.1/);
  assert.match(body, /hostfwd=tcp:"\$LISTEN_ADDR":"\$ADB_PORT"-:5555/);
  assert.match(body, /androidboot\.qemu=1/);
  assert.match(body, /--token-plugin TokenFile/);
  assert.match(body, /chmod 600 "\$TOKEN_MAP"/);
  assert.match(body, /ws_alive\(\)/);
  assert.match(body, /if \[ ! -s "\$TOKEN_FILE" \]/);
  assert.match(body, /service adbd \/system\/bin\/adbd/);
  assert.match(body, /on property:ro\.kernel\.qemu=1/);
  assert.match(body, /on property:persist\.service\.adb\.enable=1/);
  assert.match(body, /on property:ro\.secure=0/);
  assert.match(body, /start adbd/);
  assert.match(body, /qemu=1/);
  assert.match(body, /command -v websockify/);
  assert.match(body, /WEB_ROOT:-\/usr\/share\/novnc/);
});

test('cloud Android pins Android-x86 9.0-r2 provenance', () => {
  const body = fs.readFileSync(script, 'utf8');
  assert.match(body, /android-x86_64-9\.0-r2\.iso/);
  assert.match(body, /f7eb8fc56f29ad5432335dc054183acf086c539f3990f0b6e9ff58bd6df4604e/);
});

// Regression note: run 37375844129 (SHA 4b42eda) failed because the script
// starts adbd on property:ro.kernel.qemu=1 instead of `on post-fs-data`.
// Keep the public-key-only contract; do not require the removed init trigger.
test('cloud Android injects only an operator public key', () => {
  const body = fs.readFileSync(script, 'utf8');
  assert.match(body, /CLOUD_ANDROID_ADB_PUBLIC_KEY_FILE/);
  assert.match(body, /adbkey\.pub/);
  assert.match(body, /ro\.adb\.secure=1/);
  assert.match(body, /ro\.secure=0/);
  assert.match(body, /service\.adb\.root 1/);
  assert.match(body, /on property:ro\.kernel\.qemu=1/);
  assert.match(body, /start adbd/);
  assert.doesNotMatch(body, /ro\.adb\.secure=0/);
  assert.doesNotMatch(body, /on post-fs-data/);
});
