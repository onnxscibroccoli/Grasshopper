#!/usr/bin/env bash
# Staged OCI remote access boot hardening: protected services remain untouched.
# Audit normally; operator may run 'sudo bash ... install-root' after CI approval.
# No sudo passwords, sudoers modifications, kernel modules or restarts.
set -Eeuo pipefail
umask 077

ACTION="${1:-audit}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
UNIT_SOURCE="$SCRIPT_DIR/../../deploy/systemd/grasshopper-rdc.service"
UNIT_TARGET="/etc/systemd/system/grasshopper-rdc.service"
BASE_SERVICES=(grasshopper-vnc.service grasshopper-novnc.service grasshopper-mcp.service)
RDC_HOME="/home/grasshopper"
status=0

emit() { printf '%s=%s\n' "$1" "$2"; }

baseline() {
  for unit in "${BASE_SERVICES[@]}"; do
    if systemctl is-enabled --quiet "$unit" && systemctl is-active --quiet "$unit"; then
      emit "$unit" "ENABLED_ACTIVE"
    else
      emit "$unit" "NOT_VERIFIED"
      status=2
    fi
  done
  local result
  result="$(curl --silent --max-time 5 --output /dev/null --write-out '%{http_code}' \
    http://127.0.0.1:6080/vnc.html || true)"
  if [[ "$result" == 200 ]]; then
    emit "NOVNC_HTTP" "200"
  else
    emit "NOVNC_HTTP" "NOT_VERIFIED"
    status=2
  fi
  if [[ -f "$RDC_HOME/.desktop-commander-device/device.json" ]]; then
    emit "RDC_LOCAL_SESSION" "PRESENT"
  else
    emit "RDC_LOCAL_SESSION" "MISSING_OPERATOR_SIGN_IN_REQUIRED"
    status=2
  fi
  if [[ ! -f "$UNIT_SOURCE" ]] || [[ -L "$UNIT_SOURCE" ]]; then
    emit "SERVICE_SOURCE" "MISSING_OR_SYMLINK"
    status=2
  fi
  if ! id grasshopper >/dev/null 2>&1; then
    emit "RDC_UNPRIVILEGED_USER" "NOT_FOUND"
    status=2
  fi
  if [[ ! -x /usr/bin/npx ]]; then
    emit "RDC_NPX" "NOT_FOUND"
    status=2
  fi
  return "$status"
}

case "$ACTION" in
  audit)
    baseline || :
    emit "INSTALLATION_MUTATIONS" "NONE"
    exit "$status"
    ;;
  install-root)
    if [[ "$(id -u)" != 0 ]]; then
      echo "BLOCKED: run with sudo explicitly from a trusted host console." >&2
      exit 2
    fi
    if [[ "${GRASSHOPPER_RDC_BOOT_APPROVED:-}" != "YES" ]]; then
      echo "BLOCKED: GRASSHOPPER_RDC_BOOT_APPROVED=YES required." >&2
      exit 2
    fi
    baseline
    systemd-analyze verify "$UNIT_SOURCE"
    if [[ -e "$UNIT_TARGET" ]]; then
      if cmp -s "$UNIT_SOURCE" "$UNIT_TARGET"; then
        emit "RDC_SERVICE_UNIT" "ALREADY_STAGED"
      else
        echo "BLOCKED: existing unit differs. No automatic replacement." >&2
        exit 2
      fi
    else
      install -o root -g root -m 0644 "$UNIT_SOURCE" "$UNIT_TARGET"
      emit "RDC_SERVICE_UNIT" "STAGED"
    fi
    systemctl daemon-reload
    # Enable for NEXT boot only. Do not start/restart active RDC sessions.
    systemctl enable grasshopper-rdc.service
    emit "RDC_NEXT_BOOT" "ENABLED_NO_START"
    emit "PROTECTED_SERVICES_RESTARTED" "NO"
    ;;
  verify)
    baseline || :
    if systemctl is-enabled --quiet grasshopper-rdc.service; then
      emit "RDC_UNIT_ENABLED" "YES"
    else
      emit "RDC_UNIT_ENABLED" "NO"
      status=2
    fi
    if systemctl is-active --quiet grasshopper-rdc.service; then
      emit "RDC_UNIT_ACTIVE" "YES"
    else
      emit "RDC_UNIT_ACTIVE" "NO"
      status=2
    fi
    emit "OUT_OF_BAND_RDC_DEVICE_PROOF" "OPERATOR_OR_CONNECTOR_REQUIRED"
    exit "$status"
    ;;
  *)
    echo "Usage: bash $0 {audit|install-root|verify}" >&2
    exit 3
    ;;
esac
