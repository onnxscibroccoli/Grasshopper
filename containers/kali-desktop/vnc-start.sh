#!/bin/bash
set -eu
if [ -n "${VNC_PASSWORD:-}" ]; then
  install -m 600 /dev/null /tmp/vnc.pass
  printf '%s\n' "$VNC_PASSWORD" > /tmp/vnc.pass
  exec /usr/bin/x11vnc -display :1 -forever -shared -localhost -rfbport 5900 -rfbauth /tmp/vnc.pass -noxrecord -noxfixes -noxdamage
fi
exec /usr/bin/x11vnc -display :1 -forever -shared -localhost -rfbport 5900 -nopw -noxrecord -noxfixes -noxdamage
