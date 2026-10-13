#!/usr/bin/env bash
# OCI Redroid admission gate; reads only. Run before any kernel or container mutation.
# Exit 0=admitted, 2=blocked, 3=execution/error. No sensitive values printed.
set -Eeuo pipefail
LC_ALL=C; export LC_ALL
mode="${1:-preflight}"
[[ "$mode" == "preflight" || "$mode" == "status" ]] || { echo "Usage: bash $0 [preflight|status]" >&2; exit 3; }
work_root="${REDROID_DATA_ROOT:-/srv/grasshopper}"
engine="${REDROID_ENGINE:-podman}"
image="${REDROID_IMAGE:-redroid/redroid:16.0.0_64only-latest}"
port="${REDROID_LOOPBACK_PORT:-5556}"
reason=()
notice=()
pass() { notice+=("$1"); }
block() { reason+=("$1"); }
if [[ "$(uname -m)" != "aarch64" ]]; then block arch_not_aarch64; else pass arch_arm64; fi
kernel="$(uname -r)"
if [[ "$kernel" != *el9uek.aarch64 ]]; then block oracle_uek_kernel_not_confirmed; else pass oracle_uek_kernel; fi
if [[ -f "/boot/config-$kernel" ]]; then
  if grep -q '^CONFIG_ANDROID_BINDER_IPC=y$' "/boot/config-$kernel"; then pass binder_builtin;
  else pass binder_not_builtin; fi
else block kernel_config_missing; fi
for d in binder hwbinder vndbinder; do
  if [[ -c "/dev/$d" ]]; then pass "character_device_$d"; else block "missing_character_device_$d"; fi
done
if [[ "$mode" == "preflight" ]]; then
  if [[ -d "$work_root" ]] && [[ "$(stat -c %d "$work_root")" != "$(stat -c %d /)" ]]; then
    pass separate_persistent_data_filesystem
  else block persistent_data_filesystem_missing; fi
  available="$(df -Pk "$work_root" 2>/dev/null | awk 'NR==2 {print $4}' || true)"
  if [[ "$available" =~ ^[0-9]+$ ]] && (( available >= 8388608 )); then pass disk_space_at_least_8_gib;
  else block insufficient_data_filesystem_headroom; fi
  mem="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
  if [[ "$mem" =~ ^[0-9]+$ ]] && (( mem >= 5242880 )); then pass available_memory_at_least_5_gib;
  else block insufficient_available_memory_for_side_by_side_launch; fi
  if pgrep -f '[q]emu-system-aarch64' >/dev/null 2>&1; then block qemu_android_still_active_preserve_until_migration;
  else pass qemu_not_detected; fi
  if [[ "$port" =~ ^[0-9]+$ ]] && (( port>1024 && port<65536 )); then
    if ss -H -ltn "( sport = :$port )" 2>/dev/null | grep -q .; then block redroid_loopback_port_in_use;
    else pass host_adb_port_unused; fi
  else block invalid_port; fi
  if ! command -v "$engine" >/dev/null 2>&1; then block runtime_not_installed;
  elif [[ "$engine" == "podman" ]]; then
    if [[ "$(id -u)" != "0" ]]; then block podman_is_rootless_kernel_device_setup_unavailable; fi
    root="$(podman info --format '{{.Store.GraphRoot}}' 2>/dev/null || true)"
    if [[ "$root" == "$work_root/"* ]]; then pass container_store_on_data_volume;
    else block container_store_not_on_data_volume; fi
  elif [[ "$(id -u)" != "0" ]]; then block root_privilege_for_kernel_runtime_unavailable;
  fi
  if [[ "$image" != redroid/redroid:* ]]; then block unexpected_android_image; fi
fi
printf '{ "schema": "grasshopper.redroid.admission/v1", "mode": "%s", "status": "%s", "checks": [' "$mode" "$([[ "${#reason[@]}" == 0 ]] && echo PASS || echo BLOCKED)"
first=1
for x in "${notice[@]}"; do
  [[ "$first" == 1 ]] || printf ','
  printf '{"name":"%s","result":"PASS"}' "$x"
  first=0
done
for x in "${reason[@]}"; do
  [[ "$first" == 1 ]] || printf ','
  printf '{"name":"%s","result":"BLOCKED"}' "$x"
  first=0
done
printf '] }\n'
(( ${#reason[@]} == 0 )) || exit 2
