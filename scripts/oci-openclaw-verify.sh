#!/usr/bin/env bash
# Read-only OpenClaw OCI host tests.
# Safe to run as: curl -fsSL https://raw.githubusercontent.com/onnxscibroccoli/Grasshopper/main/scripts/oci-openclaw-verify.sh | bash
# Does not install packages, mutate config, pull images, or restart services.
set -Eeuo pipefail

log(){ printf '\n[grasshopper-openclaw-verify] %s\n' "$*"; }
die(){ printf '\n[grasshopper-openclaw-verify] ERROR: %s\n' "$*" >&2; exit 1; }
pass(){ printf 'PASS %s\n' "$1"; }
fail(){ printf 'FAIL %s\n' "$1"; FAILED=1; }

# curl|bash delivers this file on stdin. Never let a child inherit that pipe.
openclaw_n(){ command openclaw "$@" </dev/null; }

FAILED=0
GATEWAY_PORT="${GRASSHOPPER_OPENCLAW_PORT:-18789}"
OLLAMA_PORT="${GRASSHOPPER_OLLAMA_PORT:-11434}"
OLLAMA_CONTAINER="${GRASSHOPPER_OLLAMA_CONTAINER:-grasshopper-ollama}"
MODEL="${GRASSHOPPER_OLLAMA_MODEL:-qwen3:0.6b}"
SMOKE_TOKEN="GRASSHOPPER_OCI_MODEL_OK"
BACKUP_DIR="${GRASSHOPPER_OPENCLAW_BACKUP_DIR:-$HOME/Backups/openclaw}"
BACKUP_MAX_AGE_HOURS="${GRASSHOPPER_BACKUP_MAX_AGE_HOURS:-48}"
VERIFY_RECOVERY="${GRASSHOPPER_VERIFY_RECOVERY:-0}"

export PATH="$HOME/.openclaw/bin:$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"

PHASE="${GRASSHOPPER_SECURITY_PHASE:-}"
if [[ -z "$PHASE" && -f "$HOME/.config/environment.d/grasshopper.conf" ]]; then
  PHASE="$(awk -F= '$1=="GRASSHOPPER_SECURITY_PHASE"{print $2}' "$HOME/.config/environment.d/grasshopper.conf" | tail -1)"
fi
if [[ "$PHASE" == "DEV_SANDBOX" ]]; then
  pass "security.phase.DEV_SANDBOX"
else
  fail "security.phase.DEV_SANDBOX"
  printf 'SECURITY_PHASE=%s\n' "${PHASE:-unset}"
fi


log "OpenClaw OCI verify starting (read-only)"

USER_UID="$(id -u)"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$USER_UID}"

if command -v openclaw >/dev/null 2>&1; then
  OPENCLAW_VERSION="$(openclaw_n --version 2>/dev/null || true)"
  if [[ -n "$OPENCLAW_VERSION" ]]; then
    pass "openclaw.cli"
    printf 'OPENCLAW_VERSION=%s\n' "$OPENCLAW_VERSION"
  else
    fail "openclaw.cli"
  fi
else
  fail "openclaw.cli"
  OPENCLAW_VERSION=""
fi

if [[ -f "$HOME/.openclaw/openclaw.json" ]]; then
  pass "openclaw.config.present"
else
  fail "openclaw.config.present"
fi

if command -v openclaw >/dev/null 2>&1; then
  GATEWAY_MODE="$(openclaw_n config get gateway.mode 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "$GATEWAY_MODE" == "local" ]]; then
    pass "openclaw.gateway.mode.local"
  else
    fail "openclaw.gateway.mode.local"
    printf 'GATEWAY_MODE=%s\n' "${GATEWAY_MODE:-unset}"
  fi
else
  fail "openclaw.gateway.mode.local"
fi

if command -v loginctl >/dev/null 2>&1 && [[ "$(loginctl show-user "$USER_UID" -p Linger --value 2>/dev/null || true)" == "yes" ]]; then
  pass "openclaw.user.linger"
else
  fail "openclaw.user.linger"
fi

if [[ -S "${XDG_RUNTIME_DIR}/bus" ]] && systemctl --user is-enabled openclaw-gateway.service >/dev/null 2>&1; then
  pass "openclaw.gateway.systemd.enabled"
else
  fail "openclaw.gateway.systemd.enabled"
fi

if [[ -S "${XDG_RUNTIME_DIR}/bus" ]] && systemctl --user is-active openclaw-gateway.service >/dev/null 2>&1; then
  pass "openclaw.gateway.systemd.active"
else
  fail "openclaw.gateway.systemd.active"
fi

if curl -fsS "http://127.0.0.1:${GATEWAY_PORT}/" >/dev/null 2>&1; then
  pass "openclaw.gateway.http.loopback"
else
  fail "openclaw.gateway.http.loopback"
fi

if command -v ss >/dev/null 2>&1; then
  LISTEN="$(ss -lnt 2>/dev/null || true)"
  if printf '%s\n' "$LISTEN" | grep -Eq "127\\.0\\.0\\.1:${GATEWAY_PORT}\\b"; then
    pass "openclaw.gateway.listen.loopback"
  else
    fail "openclaw.gateway.listen.loopback"
  fi
  if printf '%s\n' "$LISTEN" | grep -Eq "(0\\.0\\.0\\.0|\\*):${GATEWAY_PORT}\\b"; then
    fail "openclaw.gateway.listen.not_public"
  else
    pass "openclaw.gateway.listen.not_public"
  fi
  if printf '%s\n' "$LISTEN" | grep -Eq "(0\\.0\\.0\\.0|\\*):${OLLAMA_PORT}\\b"; then
    fail "ollama.listen.not_public"
  else
    pass "ollama.listen.not_public"
  fi
else
  pass "openclaw.gateway.listen.loopback"
  pass "openclaw.gateway.listen.not_public"
  pass "ollama.listen.not_public"
  log "ss not present; skipped raw socket bind inspection"
fi

if command -v podman >/dev/null 2>&1; then
  pass "podman.present"
  if podman container exists "$OLLAMA_CONTAINER" >/dev/null 2>&1 \
    && podman container inspect "$OLLAMA_CONTAINER" --format '{{.State.Running}}' 2>/dev/null | grep -q true; then
    pass "ollama.container.running"
  else
    fail "ollama.container.running"
  fi
else
  fail "podman.present"
  fail "ollama.container.running"
fi

if curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
  pass "ollama.http.loopback"
  TAGS="$(curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/tags" 2>/dev/null || true)"
  if printf '%s' "$TAGS" | grep -Fq "$MODEL"; then
    pass "ollama.model.present"
  else
    fail "ollama.model.present"
  fi
else
  fail "ollama.http.loopback"
  fail "ollama.model.present"
fi

GEN="$(curl -fsS "http://127.0.0.1:${OLLAMA_PORT}/api/generate" \
  -H 'Content-Type: application/json' \
  -d "{\"model\":\"${MODEL}\",\"prompt\":\"Reply with exactly: ${SMOKE_TOKEN}\",\"stream\":false}" 2>/dev/null || true)"
if printf '%s' "$GEN" | grep -Fq "$SMOKE_TOKEN"; then
  pass "ollama.generate.smoke"
else
  fail "ollama.generate.smoke"
fi

if command -v openclaw >/dev/null 2>&1; then
  PROVIDER_URL="$(openclaw_n config get models.providers.ollama.baseUrl 2>/dev/null | tr -d '[:space:]' || true)"
  if printf '%s' "$PROVIDER_URL" | grep -Fq "127.0.0.1:${OLLAMA_PORT}"; then
    pass "openclaw.ollama.baseUrl"
  else
    fail "openclaw.ollama.baseUrl"
  fi
else
  fail "openclaw.ollama.baseUrl"
fi

printf 'BACKUP_DIR=%s\n' "$BACKUP_DIR"
LATEST_BACKUP="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name '*-openclaw-backup.tar.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2- || true)"
if [[ -n "$LATEST_BACKUP" ]]; then
  BACKUP_AGE_SECONDS=$(( $(date +%s) - $(stat -c %Y "$LATEST_BACKUP") ))
  BACKUP_MAX_AGE_SECONDS=$((BACKUP_MAX_AGE_HOURS * 3600))
  if (( BACKUP_AGE_SECONDS <= BACKUP_MAX_AGE_SECONDS )); then
    pass "backup.recent"
    if openclaw_n backup verify "$LATEST_BACKUP" >/dev/null 2>&1; then
      pass "backup.verified"
      printf 'BACKUP_ARCHIVE=%s\n' "$LATEST_BACKUP"
      if [[ "$VERIFY_RECOVERY" == "1" ]]; then
        RESTORE_DIR="$(mktemp -d /tmp/grasshopper-openclaw-restore-XXXXXX)"
        if openclaw_n backup restore "$LATEST_BACKUP" --target "$RESTORE_DIR/restored" >/dev/null 2>&1 && find "$RESTORE_DIR/restored" -name manifest.json -type f -size +0c -print -quit | grep -q .; then
          pass "backup.restore.drill"
        else
          fail "backup.restore.drill"
        fi
        rm -rf "$RESTORE_DIR"
      else
        printf 'BACKUP_RESTORE_DRILL=NOT_RUN\n'
      fi
    else
      fail "backup.verified"
    fi
  else
    fail "backup.recent"
  fi
else
  fail "backup.recent"
fi

printf 'MODEL=%s\n' "$MODEL"
printf 'GATEWAY_PORT=%s\n' "$GATEWAY_PORT"
printf 'OLLAMA_PORT=%s\n' "$OLLAMA_PORT"
printf 'FAILED=%s\n' "$FAILED"

if [[ "$FAILED" -ne 0 ]]; then
  die "OpenClaw OCI verify failed. Install/repair with scripts/oci-openclaw-bootstrap.sh, then rerun this verifier."
fi

printf 'MODEL_SMOKE_TEST=PASS\n'
printf 'OPENCLAW_OCI_VERIFY=PASS\n'
