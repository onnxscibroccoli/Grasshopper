#!/usr/bin/env bash
# Zero-mutation, pre-reboot OCI workstation read-only audit.
# This is NOT authorization to restart: it always requires separate external
# remote-access, OCI serial console, Kali container persistence and rollback.
set -Eeuo pipefail
umask 077

outdir="${1:-}"
if [[ -n "$outdir" ]] && [[ ! -d "$outdir" ]]; then
  echo "BOOT_AUDIT=BLOCKED_UNKNOWN_OUTPUT_DIRECTORY" >&2; exit 2
fi

failures=()
pass() { echo "$1=PASS"; }
block() { echo "$1=NOT_PROVEN"; failures+=("$1"); }
test_service() {
  local svc="$1"
  if systemctl is-active --quiet "$svc" &&
     systemctl is-enabled --quiet "$svc" &&
     [[ "$(systemctl show "$svc" -p Restart --value 2>/dev/null)" == always ]]; then
    pass "BOOT_UNIT_${svc//[.-]/_}"
  else
    block "BOOT_UNIT_${svc//[.-]/_}"
  fi
}
[[ "$(uname -m)" == aarch64 ]] && pass OCI_ARM64 || block OCI_ARM64
[[ "$(uname -r)" == *el9uek.aarch64 ]] && pass ORACLE_UEK || block ORACLE_UEK
[[ -d /srv/grasshopper ]] &&
[[ "$(stat -c %d /srv/grasshopper)" != "$(stat -c %d /)" ]] &&
  pass SEPARATE_ANDROID_DATA_VOLUME || block SEPARATE_ANDROID_DATA_VOLUME

for svc in grasshopper-vnc.service grasshopper-novnc.service grasshopper-mcp.service; do
  test_service "$svc"
done

code="$(curl --silent --max-time 5 -o /dev/null -w '%{http_code}' \
  http://127.0.0.1:6080/vnc.html || true)"
[[ "$code" == 200 ]] && pass NOVNC_LOOPBACK_HTTP || block NOVNC_LOOPBACK_HTTP

if systemctl is-enabled --quiet grasshopper-rdc.service; then
  pass RDC_BOOT_ENABLED
else
  block RDC_BOOT_ENABLED
fi

if command -v grubby >/dev/null 2>&1; then
  num="$(grubby --info=ALL 2>/dev/null | grep -c '^index=' || true)"
  if [[ "$num" =~ ^[0-9]+$ ]] && (( num >= 2 )); then
    pass KERNEL_ALTERNATE_BOOT_ENTRIES_PRESENT
  else block KERNEL_ALTERNATE_BOOT_ENTRIES_PRESENT; fi
else block KERNEL_ALTERNATE_BOOT_ENTRIES_PRESENT; fi

# Kali is a Podman container and must be verified at the actual host container
# management level; process state inside Kali cannot prove restart on host boot.
block KALI_PODMAN_CONTAINER_RESTART_POLICY_EXTERNAL_PROOF
block RUSTDESK_EXTERNAL_CLIENT_RECONNECT_PROOF
block OCI_SERIAL_CONSOLE_AND_PREVIOUS_KERNEL_RECOVERY_PROOF
block PRODUCTION_REBOOT_TEST_WITH_OPERATOR_APPROVAL
if pgrep -f '[q]emu-system-aarch64' >/dev/null 2>&1; then
  pass EXISTING_QEMU_ANDROID_PRESERVED
else
  block EXISTING_QEMU_ANDROID_PRESERVED
fi
echo "PROTECTED_SERVICES_RESTARTED=NO"
echo "HOST_REBOOTED=NO"
echo "KERNEL_MODIFIED=NO"
echo "RESULT=BLOCKED_NOT_READY_FOR_REBOOT"
exit 2
