#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
ROOT="${BROCCOLI_ROOT:-$HOME/broccoli-core}"
PREFIX_DIR="${PREFIX:-/data/data/com.termux/files/usr}"
PYTHON="${BROCCOLI_PYTHON:-$PREFIX_DIR/bin/python3}"
LOG_DIR="$ROOT/reports"
PID_FILE="$ROOT/runtime-supervisor.pid"
LOG_FILE="$LOG_DIR/runtime-supervisor.log"
INTERVAL="${BROCCOLI_SUPERVISOR_INTERVAL:-5}"

mkdir -p "$LOG_DIR"
cd "$ROOT"

log() { printf '%s %s\n' "$(date -Iseconds)" "$*" >> "$LOG_FILE"; }

if command -v termux-wake-lock >/dev/null 2>&1; then termux-wake-lock >/dev/null 2>&1 || true; log "WAKE_LOCK requested"; fi

child_alive() {
  [ -f "$ROOT/runtime.pid" ] || return 1
  local pid
  pid="$(cat "$ROOT/runtime.pid" 2>/dev/null || true)"
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  ps -p "$pid" -o args= 2>/dev/null | grep -Fq "$ROOT/runtime/main.py"
}

start_child() {
  if child_alive; then return 0; fi
  nohup "$PYTHON" -u "$ROOT/runtime/main.py" >> "$ROOT/runtime.log" 2>&1 &
  local pid=$!
  printf '%s\n' "$pid" > "$ROOT/runtime.pid"
  log "START child pid=$pid"
}

cleanup() {
  if command -v termux-wake-unlock >/dev/null 2>&1; then termux-wake-unlock >/dev/null 2>&1 || true; fi
  rm -f "$PID_FILE"
  log "STOP supervisor"
}
trap cleanup INT TERM EXIT

if [ -f "$PID_FILE" ]; then
  old="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$old" ] && kill -0 "$old" 2>/dev/null; then log "ALREADY_RUNNING pid=$old"; exit 0; fi
fi
printf '%s\n' "$$" > "$PID_FILE"
log "START supervisor pid=$$ root=$ROOT"

while :; do start_child; sleep "$INTERVAL"; done
