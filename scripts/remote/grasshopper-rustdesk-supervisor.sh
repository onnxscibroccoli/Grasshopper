#!/usr/bin/env bash
# Grasshopper RustDesk 1.4.9 portable ARM64 client supervisor.
# Runs only as user grasshopper; no root, no server changes.
set -uo pipefail
export HOME=/home/grasshopper
export DISPLAY=:1
export XAUTHORITY=/home/grasshopper/.Xauthority
export XDG_RUNTIME_DIR=/run/user/1001
export DBUS_SESSION_BUS_ADDRESS='unix:abstract=/tmp/dbus-7EYZKKjJ6Y,guid=aae3930d34bb8d5694fa08736acd14e5'
APP="$HOME/.local/opt/rustdesk-1.4.9/usr/share/rustdesk"
LOG="$HOME/.local/state/grasshopper-cloud-auth/rustdesk-client.log"
mkdir -p "$(dirname "$LOG")"
chmod 700 "$(dirname "$LOG")"
cd "$APP" || exit 3
while :; do
  if pgrep -u "$(id -u)" -x rustdesk >/dev/null 2>&1; then
    sleep 5
  else
    echo "$(date -Iseconds) Starting RustDesk ARM64 client" >> "$LOG"
    "$APP/rustdesk" >> "$LOG" 2>&1 || echo "$(date -Iseconds) RustDesk client ended; restarting" >> "$LOG"
    sleep 5
  fi
done
