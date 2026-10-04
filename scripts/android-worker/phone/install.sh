#!/usr/bin/env bash
set -Eeuo pipefail
SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT=/srv/grasshopper/android/viewer
export XDG_RUNTIME_DIR=/run/user/$(id -u)
export DBUS_SESSION_BUS_ADDRESS=unix:path=$XDG_RUNTIME_DIR/bus
[[ -d /opt/noVNC/core && -s "$HOME/.desktop-session/token-map" ]]
PYTHONPATH=/opt/noVNC/utils/websockify /usr/bin/python3 -c "import websockify"
mkdir -p "$ROOT"
cp -R /opt/noVNC/core /opt/noVNC/app /opt/noVNC/vendor "$ROOT/"
cp /opt/noVNC/vnc.html /opt/noVNC/vnc_lite.html "$ROOT/"
cp "$SOURCE"/phone.html "$SOURCE"/phone.mjs "$SOURCE"/input.mjs "$ROOT/"
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/grasshopper-viewer-gateway.service" <<UNIT
[Unit]
Description=Private desktop and Android viewer gateway
After=network-online.target
[Service]
Environment=PYTHONPATH=/opt/noVNC/utils/websockify
ExecStart=/usr/bin/python3 -m websockify --token-plugin TokenFile --token-source %h/.desktop-session/token-map --web $ROOT --heartbeat 30 127.0.0.1:6081
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
UMask=0077
[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable grasshopper-viewer-gateway.service
if ! systemctl --user is-active --quiet grasshopper-viewer-gateway.service; then
 python3 - <<'PY'
import os,signal
from pathlib import Path
p=Path.home()/'.desktop-session/websockify.pid'
if p.exists():
 pid=int(p.read_text())
 args=Path('/proc/%d/cmdline'%pid).read_bytes()
 assert b'websockify' in args and b'--token-plugin' in args
 os.kill(pid,signal.SIGTERM)
PY
fi
systemctl --user restart grasshopper-viewer-gateway.service
python3 - <<'PY'
import time,urllib.request
for attempt in range(20):
 try:
  with urllib.request.urlopen('http://127.0.0.1:6081/phone.html',timeout=1) as r:
   assert r.status==200
  break
 except OSError:
  if attempt==19: raise
  time.sleep(.25)
PY
systemctl --user is-active grasshopper-viewer-gateway.service
echo 'Viewer deployed and HTTP verified; Android runtime unchanged.'
