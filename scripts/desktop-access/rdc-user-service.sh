#!/usr/bin/env bash
# Install only a non-root systemd user unit; never copies device OAuth sessions.
set -Eeuo pipefail
umask 077
mode="${1:---audit}"
case "$mode" in --audit|--render|--install|--verify) ;; *)
  echo "Usage: bash $0 [--audit|--render|--install|--verify]" >&2;exit 64;; esac
if (( EUID == 0 )); then echo "BLOCKED: run RDC as the workstation user, never root";exit 2;fi
node="${RDC_NODE_BIN:-/usr/bin/node}"
pkg="${RDC_PACKAGE_ROOT:-$HOME/.local/opt/grasshopper-rdc}"
entry="$pkg/node_modules/@wonderwhy-er/desktop-commander/dist/index.js"
unit_home="$HOME/.config/systemd/user"
unit_path="$unit_home/grasshopper-rdc-remote.service"
[[ "$pkg" == /* && "$pkg" != *$'\n'* && "$pkg" != *' '* && "$pkg" != *'..'* ]] ||
  { echo "BLOCKED: package path must be absolute, ordinary, and whitespace-free";exit 2; }
[[ "$node" == /* && -x "$node" ]] || { echo "BLOCKED: node binary not present";exit 2; }
generate_unit() {
  cat <<UNIT
[Unit]
Description=Grasshopper Desktop Commander Remote Device (user only)
Documentation=https://github.com/wonderwhy-er/DesktopCommanderMCP
After=default.target
StartLimitIntervalSec=0

[Service]
Type=simple
WorkingDirectory=%h
Environment=HOME=%h
UMask=0077
ExecStart=$node $entry remote
Restart=always
RestartSec=15
NoNewPrivileges=true

[Install]
WantedBy=default.target
UNIT
}
if [[ "$mode" == "--render" ]]; then generate_unit;exit 0;fi
if [[ "$mode" == "--audit" ]]; then
  echo "RDC_NODE=$([[ -x "$node" ]] && echo PRESENT || echo MISSING)"
  echo "RDC_PACKAGE=$([[ -f "$entry" ]] && echo STAGED || echo NOT_STAGED)"
  echo "RDC_USER_UNIT=$([[ -f "$unit_path" ]] && echo PRESENT || echo ABSENT)"
  loginctl show-user "$(id -un)" -p Linger 2>/dev/null || true
  echo "INSTALLATION_EXECUTED=NO"
  exit 0
fi
if [[ "$mode" == "--install" ]]; then
  [[ -f "$entry" ]] || { echo "BLOCKED: first stage a pinned local package as an unprivileged user";exit 2; }
  [[ ! -e "$unit_path" && ! -L "$unit_path" ]] ||
    { echo "BLOCKED: existing RDC user unit cannot be overwritten";exit 2; }
  mkdir -p -m 700 "$unit_home"
  tmp="$(mktemp "$unit_home/.grasshopper-rdc-remote.service.XXXXXX")"
  trap 'rm -f "$tmp"' EXIT
  generate_unit >"$tmp"
  chmod 600 "$tmp"
  mv -n "$tmp" "$unit_path"
  systemctl --user daemon-reload
  systemctl --user enable grasshopper-rdc-remote.service >/dev/null
  echo "RDC_UNIT=INSTALLED_AND_ENABLED_NOT_STARTED"
  echo "NEXT=operator review: terminate only redundant manual Remote Device process; then explicitly start the unit locally"
  echo "LOGIN_SESSION_COPIED=NO"
  exit 0
fi
if [[ "$mode" == "--verify" ]]; then
  test -f "$unit_path" && test -f "$entry" || { echo "RDC=NOT_STAGED";exit 2; }
  enabled="$(systemctl --user is-enabled grasshopper-rdc-remote.service 2>/dev/null || true)"
  running="$(systemctl --user is-active grasshopper-rdc-remote.service 2>/dev/null || true)"
  echo "RDC_UNIT_ENABLED=$enabled"
  echo "RDC_UNIT_ACTIVE=$running"
  echo "REMOTE_MCP_HANDSHAKE=NOT_TESTED_BY_LOCAL_PROCESS_CHECK"
  [[ "$enabled" == enabled && "$running" == active ]] || exit 2
fi
