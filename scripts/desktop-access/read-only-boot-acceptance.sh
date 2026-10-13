#!/usr/bin/env bash
# Read-only: post-reboot health only, never starts/restarts services.
set -Eeuo pipefail
LC_ALL=C
status=0
check_unit() {
  local unit="$1"
  if systemctl is-enabled "$unit" >/dev/null 2>&1 && systemctl is-active "$unit" >/dev/null 2>&1; then
    printf 'PASS %s enabled active\n' "$unit"
  else
    printf 'FAIL %s not enabled+active\n' "$unit"; status=2
  fi
}
for unit in grasshopper-vnc.service grasshopper-novnc.service grasshopper-mcp.service grasshopper-rdc.service; do
  check_unit "$unit"
done
for uri in http://127.0.0.1/vnc.html http://127.0.0.1:6080/vnc.html; do
  code="$(curl --max-time 5 -s -o /dev/null -w '%{http_code}' "$uri" || true)"
  if [[ "$code" == 200 ]]; then echo 'PASS loopback viewer HTTP 200'
  else echo "FAIL viewer HTTP $code"; status=2; fi
done
if mountpoint -q /srv/grasshopper; then echo 'PASS persistent volume mounted'
else echo 'FAIL persistent volume missing'; status=2; fi
echo 'KALI_INTERACTIVE_DESKTOP=REQUIRES_SEPARATE_ACCEPTANCE'
echo 'RDC_AUTHENTICATED_RECONNECT=REQUIRES_SEPARATE_ACCEPTANCE'
echo 'ANDROID_GUI_INPUT=REQUIRES_SEPARATE_ACCEPTANCE'
exit "$status"
