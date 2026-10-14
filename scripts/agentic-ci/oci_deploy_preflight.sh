#!/usr/bin/env bash
# Read-only OCI Android deployment safety preflight. Never reboots or restarts.
set -Eeuo pipefail
umask 077
root=/srv/grasshopper
status=0
pass() { printf '%s=PASS\n' "$1"; }
fail() { printf '%s=BLOCKED\n' "$1"; status=2; }
[[ "$(uname -m)" == aarch64 ]] && pass ARM64 || fail ARM64
[[ "$(uname -r)" == *el9uek.aarch64 ]] && pass ORACLE_UEK || fail ORACLE_UEK
[[ -d "$root" ]] && [[ "$(stat -c %d "$root")" != "$(stat -c %d /)" ]] &&
  pass DATA_VOLUME || fail DATA_VOLUME
for svc in grasshopper-vnc.service grasshopper-novnc.service grasshopper-mcp.service; do
  if systemctl is-enabled --quiet "$svc" && systemctl is-active --quiet "$svc"; then
    pass "PROTECTED_${svc//[.-]/_}"
  else fail "PROTECTED_${svc//[.-]/_}"; fi
done
http="$(curl -sS --max-time 5 -o /dev/null -w '%{http_code}' \
  http://127.0.0.1:6080/vnc.html 2>/dev/null || true)"
[[ "$http" == 200 ]] && pass NOVNC_HTTP || fail NOVNC_HTTP
# Kali workstation is another remote device, not this OCI host.
echo "KALI_RDC_HEALTH=SEPARATE_REMOTE_ACCEPTANCE_REQUIRED"
for dev in binder hwbinder vndbinder; do
  [[ -c "/dev/$dev" ]] && pass "BINDER_$dev" || fail "BINDER_$dev"
done
if command -v oci >/dev/null; then
  if oci iam region list --auth instance_principal --no-retry --output json \
        >/dev/null 2>&1; then pass OCI_INSTANCE_PRINCIPAL
  else fail OCI_INSTANCE_PRINCIPAL; fi
else fail OCI_CLI; fi
if pgrep -f '[q]emu-system-aarch64' >/dev/null 2>&1; then
  echo "LEGACY_QEMU_ANDROID=PRESERVED"
fi
echo "KERNEL_INSTALL=NOT_PERFORMED"
echo "PROTECTED_SERVICE_RESTART=NOT_PERFORMED"
echo "REBOOT=NOT_PERFORMED"
echo "REDROID_BOOT=NOT_CLAIMED"
exit "$status"
