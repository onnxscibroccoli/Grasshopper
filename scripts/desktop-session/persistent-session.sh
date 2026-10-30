#!/usr/bin/env bash
set -Eeuo pipefail

# Persistent screen transport for an existing Xvnc desktop.
# The protected Xvnc/VNC server is never modified. x0vncserver mirrors the
# same X display with VNC authentication disabled, but binds to loopback only.
# The WebSocket edge is protected by a random per-session websockify token.
# An authenticated reverse proxy must be the only public path to LISTEN_ADDR.

STATE_DIR="${DESKTOP_SESSION_STATE_DIR:-$HOME/.desktop-session}"
DISPLAY_NUM="${DESKTOP_SESSION_DISPLAY:-:1}"
VNC_PORT="${DESKTOP_SESSION_VNC_PORT:-5902}"
LISTEN_ADDR="${DESKTOP_SESSION_LISTEN_ADDR:-127.0.0.1}"
WS_PORT="${DESKTOP_SESSION_WS_PORT:-6081}"
WEB_ROOT="${DESKTOP_SESSION_WEB_ROOT:-/opt/noVNC}"
RECONNECT_DELAY="${DESKTOP_SESSION_RECONNECT_DELAY:-1500}"
TOKEN_BYTES="${DESKTOP_SESSION_TOKEN_BYTES:-32}"

XAUTHORITY_FILE="${DESKTOP_SESSION_XAUTHORITY:-$HOME/.Xauthority}"
X0_PID="$STATE_DIR/x0vnc.pid"
WS_PID="$STATE_DIR/websockify.pid"
TOKEN_MAP="$STATE_DIR/token-map"
TOKEN_FILE="$STATE_DIR/current-token"
URL_FILE="$STATE_DIR/session-url"
LOG_DIR="$STATE_DIR/logs"

x0vnc_bin="$(command -v x0vncserver || true)"
websockify_bin="${DESKTOP_SESSION_WEBSOCKIFY_BIN:-/opt/noVNC/utils/websockify/run}"

fail() { echo "ERROR: $*" >&2; exit 2; }

require_runtime() {
  [[ -n "$x0vnc_bin" ]] || fail "x0vncserver is required"
  [[ -x "$websockify_bin" ]] || fail "websockify runner not executable: $websockify_bin"
  [[ -r "$XAUTHORITY_FILE" ]] || fail "Xauthority is not readable: $XAUTHORITY_FILE"
  [[ -d "$WEB_ROOT" ]] || fail "noVNC web root does not exist: $WEB_ROOT"
}

is_alive() {
  local pid_file="$1"
  [[ -s "$pid_file" ]] || return 1
  local pid
  pid="$(cat "$pid_file")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

stop_one() {
  local pid_file="$1"
  if is_alive "$pid_file"; then
    kill "$(cat "$pid_file")" 2>/dev/null || true
    for _ in $(seq 1 20); do
      is_alive "$pid_file" || break
      sleep 0.1
    done
  fi
  rm -f "$pid_file"
}

status() {
  printf 'display=%s vnc_port=%s listen=%s ws_port=%s\n' "$DISPLAY_NUM" "$VNC_PORT" "$LISTEN_ADDR" "$WS_PORT"
  if is_alive "$X0_PID"; then echo 'x0vnc=RUNNING'; else echo 'x0vnc=STOPPED'; fi
  if is_alive "$WS_PID"; then echo 'websockify=RUNNING'; else echo 'websockify=STOPPED'; fi
  if [[ -s "$TOKEN_FILE" ]]; then echo 'token=PRESENT'; else echo 'token=ABSENT'; fi
  if [[ -s "$URL_FILE" ]]; then echo "url_file=$URL_FILE"; fi
}

start() {
  require_runtime
  mkdir -p "$STATE_DIR" "$LOG_DIR"
  chmod 700 "$STATE_DIR" "$LOG_DIR"

  if ! is_alive "$X0_PID"; then
    echo "Starting loopback x0vncserver mirror for $DISPLAY_NUM on 127.0.0.1:$VNC_PORT"
    DISPLAY="$DISPLAY_NUM" XAUTHORITY="$XAUTHORITY_FILE" \
      "$x0vnc_bin" display="$DISPLAY_NUM" rfbport="$VNC_PORT" \
      localhost=on SecurityTypes=None AlwaysShared=on \
      >"$LOG_DIR/x0vnc.log" 2>&1 &
    echo $! > "$X0_PID"
  fi

  if ! is_alive "$WS_PID"; then
    local token
    token="$(openssl rand -hex "$TOKEN_BYTES")"
    printf '%s: 127.0.0.1:%s\n' "$token" "$VNC_PORT" > "$TOKEN_MAP"
    printf '%s\n' "$token" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_MAP" "$TOKEN_FILE"

    echo "Starting token-gated websockify on $LISTEN_ADDR:$WS_PORT"
    "$websockify_bin" --token-plugin TokenFile --token-source "$TOKEN_MAP" \
      --web "$WEB_ROOT" --heartbeat 30 "$LISTEN_ADDR:$WS_PORT" \
      >"$LOG_DIR/websockify.log" 2>&1 &
    echo $! > "$WS_PID"
  fi

  local token
  token="$(cat "$TOKEN_FILE")"
  local path
  path="websockify?token=$token"
  local url
  url="/vnc.html?autoconnect=true&reconnect=true&reconnect_delay=$RECONNECT_DELAY&resize=scale&path=$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$path")"
  printf '%s\n' "$url" > "$URL_FILE"
  chmod 600 "$URL_FILE"

  sleep 1
  is_alive "$X0_PID" || fail "x0vncserver exited; see $LOG_DIR/x0vnc.log"
  is_alive "$WS_PID" || fail "websockify exited; see $LOG_DIR/websockify.log"
  echo "PASS: persistent desktop session transport is running"
  echo "URL path stored at $URL_FILE"
  echo "The public edge MUST authenticate before proxying this WebSocket endpoint."
}

stop() {
  stop_one "$WS_PID"
  stop_one "$X0_PID"
  rm -f "$TOKEN_MAP" "$TOKEN_FILE" "$URL_FILE"
  echo "PASS: persistent desktop session transport stopped"
}

case "${1:-start}" in
  start) start ;;
  status) status ;;
  stop) stop ;;
  restart) stop; start ;;
  *) echo "Usage: $0 {start|status|stop|restart}" >&2; exit 64 ;;
esac
