#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="${BROCCOLI_ROOT:-$HOME/broccoli-core}"
SUPERVISOR="${BROCCOLI_SUPERVISOR:-$HOME/bin/broccoli-supervisor}"
LOG_DIR="$ROOT/reports"
BOOT_LOG="$LOG_DIR/termux-boot.log"

mkdir -p "$LOG_DIR" "$(dirname "$SUPERVISOR")"
exec >>"$BOOT_LOG" 2>&1

printf '%s BOOT launcher start root=%s\n' "$(date -Iseconds)" "$ROOT"

if [ ! -x "$SUPERVISOR" ]; then
  printf '%s ERROR supervisor missing: %s\n' "$(date -Iseconds)" "$SUPERVISOR"
  exit 1
fi

if [ ! -f "$ROOT/runtime/main.py" ]; then
  printf '%s ERROR runtime missing: %s\n' "$(date -Iseconds)" "$ROOT/runtime/main.py"
  exit 1
fi

exec "$SUPERVISOR"
