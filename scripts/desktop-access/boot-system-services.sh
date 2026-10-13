#!/usr/bin/env bash
# Review/CI before --apply. Does not store sudo credentials or restart services.
set -Eeuo pipefail
mode="${1:---audit}"
account="${GH_ACCESS_ACCOUNT:-grasshopper}"
units=(grasshopper-vnc.service grasshopper-novnc.service grasshopper-mcp.service)
case "$mode" in --audit|--apply|--verify) ;; *) echo "Usage: bash $0 [--audit|--apply|--verify]" >&2; exit 64;; esac
command -v systemctl >/dev/null || { echo "BLOCKED: systemd not available"; exit 2; }
command -v loginctl >/dev/null || { echo "BLOCKED: loginctl not available"; exit 2; }
if [[ ! "$account" =~ ^[a-z_][a-z0-9_-]*$ ]] || ! id "$account" >/dev/null 2>&1; then
  echo "BLOCKED: expected workstation account not found"; exit 2
fi
for unit in "${units[@]}"; do
  if [[ "$(systemctl show "$unit" -p LoadState --value)" != "loaded" ]]; then
    echo "BLOCKED: required existing service missing: $unit"; exit 2
  fi
done
if [[ "$mode" == "--apply" ]]; then
  if (( EUID != 0 )); then
    echo "BLOCKED: operator must run interactively with sudo on the desktop"; exit 2
  fi
  # Deliberately only enables known, pre-existing units. Never reloads, restarts,
  # masks, modifies ingress, or changes user password/sudoers.
  loginctl enable-linger "$account"
  for unit in "${units[@]}"; do
    systemctl enable "$unit" >/dev/null
  done
fi
failed=0
for unit in "${units[@]}"; do
  enabled="$(systemctl is-enabled "$unit" 2>/dev/null || true)"
  active="$(systemctl is-active "$unit" 2>/dev/null || true)"
  echo "SERVICE=$unit enabled=$enabled active=$active"
  if [[ "$mode" == "--verify" && ( "$enabled" != "enabled" || "$active" != "active" ) ]]; then
    failed=1
  fi
done
linger="$(loginctl show-user "$account" -p Linger --value 2>/dev/null || true)"
echo "USER_LINGER=$linger"
if [[ "$mode" == "--verify" && "$linger" != "yes" ]]; then failed=1; fi
if (( failed )); then echo "BOOT_PERSISTENCE=FAIL"; exit 2; fi
echo "BOOT_PERSISTENCE=$([[ "$mode" == "--verify" ]] && echo VERIFIED_UNIT_STATE || echo CONFIGURATION_REVIEWED)"
echo "HUMAN_VISIBLE_RECONNECT=NOT_TESTED"
echo "PRIVILEGE_MODE=NO_STORED_SUDO_CREDENTIALS"
