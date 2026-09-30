#!/usr/bin/env bash
# Verified local OpenClaw state backup for OCI.
set -Eeuo pipefail

log(){ printf '[grasshopper-openclaw-backup] %s
' "$*"; }
die(){ printf '[grasshopper-openclaw-backup] ERROR: %s
' "$*" >&2; exit 1; }

export PATH="$HOME/.openclaw/bin:$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"
openclaw_n(){ command openclaw "$@" </dev/null; }

command -v openclaw >/dev/null 2>&1 || die "OpenClaw is not installed"

BACKUP_DIR="${GRASSHOPPER_OPENCLAW_BACKUP_DIR:-$HOME/Backups/openclaw}"
RETENTION_DAYS="${GRASSHOPPER_OPENCLAW_BACKUP_RETENTION_DAYS:-7}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

log "Creating and verifying OpenClaw backup..."
openclaw_n backup create --output "$BACKUP_DIR" --verify

find "$BACKUP_DIR" -maxdepth 1 -type f -name '*-openclaw-backup.tar.gz' \
  -mtime "+$RETENTION_DAYS" -delete

LATEST="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*-openclaw-backup.tar.gz' -printf '%T@ %p
' \
  | sort -nr | head -1 | cut -d' ' -f2-)"
[[ -n "$LATEST" && -f "$LATEST" ]] || die "No verified OpenClaw backup archive found"

printf 'BACKUP_ARCHIVE=%s
' "$LATEST"
printf 'BACKUP_SIZE_BYTES=%s
' "$(stat -c '%s' "$LATEST")"
printf 'OPENCLAW_BACKUP=PASS
'
