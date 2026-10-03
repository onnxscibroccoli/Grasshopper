import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = fs.readFileSync(path.join(root, 'scripts/desktop-session/persistent-session.sh'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/REMOTE_DESKTOP_SESSION_PERSISTENCE.md'), 'utf8');

test('mirrors the existing display without changing protected VNC', () => {
  assert.match(script, /x0vncserver/);
  assert.match(script, /display=\"\$DISPLAY_NUM\"/);
  assert.match(script, /localhost=on/);
  assert.match(script, /SecurityTypes=None/);
  assert.match(script, /rfbport=\"\$VNC_PORT\"/);
});

test('token gated and loopback by default', () => {
  assert.match(script, /DESKTOP_SESSION_LISTEN_ADDR:-127\.0\.0\.1/);
  assert.match(script, /--token-plugin TokenFile/);
  assert.match(script, /--token-source \"\$TOKEN_MAP\"/);
  assert.match(script, /openssl rand -hex/);
  assert.match(script, /chmod 600 \"\$TOKEN_MAP\" \"\$TOKEN_FILE\"/);
  assert.match(script, /--heartbeat 30/);
});

test('noVNC reconnect is enabled', () => {
  assert.match(script, /autoconnect=true/);
  assert.match(script, /reconnect=true/);
  assert.match(script, /reconnect_delay=\$RECONNECT_DELAY/);
});

test('authentication remains at the browser edge', () => {
  assert.match(docs, /public edge must authenticate/i);
  assert.match(docs, /disconnect does not terminate the desktop/i);
  assert.match(docs, /credential dialog appears after reconnect/i);
});
