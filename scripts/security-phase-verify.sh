#!/usr/bin/env bash
# Read-only security phase contract verifier.
set -Eeuo pipefail

pass(){ printf 'PASS %s\n' "$1"; }
fail(){ printf 'FAIL %s\n' "$1"; FAILED=1; }
note(){ printf 'NOTE %s\n' "$1"; }

FAILED=0
PHASE="${GRASSHOPPER_SECURITY_PHASE:-}"
PERMISSIVE="${GRASSHOPPER_PERMISSIVE:-0}"
BROAD_SCOPES="${GRASSHOPPER_BROAD_OPERATOR_SCOPES:-0}"
PUBLIC_GATEWAY="${GRASSHOPPER_ALLOW_PUBLIC_GATEWAY:-0}"
SANDBOX_ID="${GRASSHOPPER_SANDBOX_ID:-}"
BACKUP_STATUS="${GRASSHOPPER_BACKUP_STATUS:-NOT_PROVEN}"
RESTORE_STATUS="${GRASSHOPPER_RESTORE_STATUS:-NOT_PROVEN}"
GATEWAY_PORT="${GRASSHOPPER_OPENCLAW_PORT:-18789}"
OLLAMA_PORT="${GRASSHOPPER_OLLAMA_PORT:-11434}"

case "$PHASE" in
  DEV_SANDBOX|STAGING|PROD_CANDIDATE|PROD) pass "security.phase.$PHASE" ;;
  "") fail "security.phase.missing" ;;
  *) fail "security.phase.unknown" ;;
esac

if [[ "$PHASE" == "DEV_SANDBOX" ]]; then
  if [[ "$PERMISSIVE" == "1" ]]; then
    [[ -n "$SANDBOX_ID" ]] && pass "dev.sandbox.id" || fail "dev.sandbox.id"
    [[ "$BROAD_SCOPES" == "1" ]] && note "DEV_SANDBOX broad operator scopes are enabled by explicit contract" || note "DEV_SANDBOX broad operator scopes are disabled"
  else
    note "DEV_SANDBOX permissive mode is disabled"
  fi
else
  [[ "$PERMISSIVE" != "1" ]] && pass "phase.no_permissive_mode" || fail "phase.no_permissive_mode"
  [[ "$BROAD_SCOPES" != "1" ]] && pass "phase.no_broad_operator_scopes" || fail "phase.no_broad_operator_scopes"
fi

[[ "$PUBLIC_GATEWAY" != "1" ]] && pass "gateway.no_public_override" || fail "gateway.no_public_override"

# Fail closed unless both backup and restore evidence are explicitly PASS.
# Contract token: FAIL restore.status / FAIL backup.status
[[ "$BACKUP_STATUS" == "PASS" ]] && pass "backup.status" || fail "backup.status"
[[ "$RESTORE_STATUS" == "PASS" ]] && pass "restore.status" || fail "restore.status"

if command -v ss >/dev/null 2>&1; then
  LISTEN="$(ss -lnt 2>/dev/null || true)"
  if printf '%s\n' "$LISTEN" | grep -Eq "(0\\.0\\.0\\.0|\\*):${GATEWAY_PORT}\\b"; then
    fail "gateway.not_public"
  else
    pass "gateway.not_public"
  fi
  if printf '%s\n' "$LISTEN" | grep -Eq "(0\\.0\\.0\\.0|\\*):${OLLAMA_PORT}\\b"; then
    fail "ollama.not_public"
  else
    pass "ollama.not_public"
  fi
else
  fail "security.socket_inspection.unavailable"
fi

printf 'PHASE=%s\n' "${PHASE:-UNSET}"
printf 'FAILED=%s\n' "$FAILED"
[[ "$FAILED" -eq 0 ]] || exit 1
printf 'SECURITY_PHASE_VERIFY=PASS\n'
