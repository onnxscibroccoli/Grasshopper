#!/usr/bin/env bash
set -Eeuo pipefail

STATE_DIR="${CLOUD_ANDROID_STATE_DIR:-$HOME/.cloud-android}"
VNC_PORT="${CLOUD_ANDROID_VNC_PORT:-5903}"
WS_PORT="${CLOUD_ANDROID_WS_PORT:-6082}"
ADB_PORT="${CLOUD_ANDROID_ADB_PORT:-5555}"
LISTEN_ADDR="${CLOUD_ANDROID_LISTEN_ADDR:-127.0.0.1}"
WEB_ROOT="${CLOUD_ANDROID_WEB_ROOT:-/opt/noVNC}"
MEMORY_MB="${CLOUD_ANDROID_MEMORY_MB:-1024}"
CPUS="${CLOUD_ANDROID_CPUS:-1}"
DATA_SIZE="${CLOUD_ANDROID_DATA_SIZE:-3G}"
ISO_URL="${CLOUD_ANDROID_ISO_URL:-https://downloads.sourceforge.net/project/android-x86/Release%209.0/android-x86_64-9.0-r2.iso}"
ISO_SHA256="${CLOUD_ANDROID_ISO_SHA256:-f7eb8fc56f29ad5432335dc054183acf086c539f3990f0b6e9ff58bd6df4604e}"

ISO="$STATE_DIR/android-x86_64-9.0-r2.iso"
DATA="$STATE_DIR/data.img"
RUNTIME="$STATE_DIR/runtime"
RAMDISK_EDIT="$STATE_DIR/ramdisk-edit"
QEMU_PID="$STATE_DIR/qemu.pid"
WS_PID="$STATE_DIR/websockify.pid"
TOKEN_MAP="$STATE_DIR/token-map"
TOKEN_FILE="$STATE_DIR/current-token"
URL_FILE="$STATE_DIR/session-url"
LOG_DIR="$STATE_DIR/logs"
ADB_KEY_FILE="${CLOUD_ANDROID_ADB_PUBLIC_KEY_FILE:-$HOME/.android/adbkey.pub}"
QEMU_BIN="$(command -v qemu-system-x86_64 || true)"
WEBSOCKIFY_BIN="${CLOUD_ANDROID_WEBSOCKIFY_BIN:-/opt/noVNC/utils/websockify/run}"

fail() { echo "ERROR: $*" >&2; exit 2; }
alive() { [ -s "$QEMU_PID" ] && kill -0 "$(cat "$QEMU_PID")" 2>/dev/null; }
ws_alive() { [ -s "$WS_PID" ] && kill -0 "$(cat "$WS_PID")" 2>/dev/null; }

require_tools() {
  [ -n "$QEMU_BIN" ] || fail "qemu-system-x86_64 is required"
  command -v curl >/dev/null || fail "curl is required"
  command -v openssl >/dev/null || fail "openssl is required"
  command -v cpio >/dev/null || fail "cpio is required"
  command -v gzip >/dev/null || fail "gzip is required"
  command -v sha256sum >/dev/null || fail "sha256sum is required"
  command -v 7z >/dev/null || fail "7z is required"
  [ -x "$WEBSOCKIFY_BIN" ] || fail "websockify runner is not executable: $WEBSOCKIFY_BIN"
  [ -d "$WEB_ROOT" ] || fail "noVNC web root does not exist: $WEB_ROOT"
  [ -r "$ADB_KEY_FILE" ] || fail "ADB public key is not readable: $ADB_KEY_FILE"
}

prepare() {
  require_tools
  mkdir -p "$STATE_DIR" "$LOG_DIR" "$RUNTIME" "$RAMDISK_EDIT"
  chmod 700 "$STATE_DIR" "$LOG_DIR"

  if [ ! -s "$ISO" ]; then
    echo "Downloading pinned Android-x86 9.0-r2..."
    curl -L --fail --retry 3 -o "$ISO.tmp" "$ISO_URL"
    mv "$ISO.tmp" "$ISO"
  fi
  actual="$(sha256sum "$ISO" | awk '{print $1}')"
  [ "$actual" = "$ISO_SHA256" ] || fail "Android ISO SHA-256 mismatch: $actual"

  if [ ! -s "$RUNTIME/kernel" ]  || [ ! -s "$RUNTIME/ramdisk.img" ] || [ ! -s "$RUNTIME/system.sfs" ]; then
    rm -rf "$RUNTIME" "$RAMDISK_EDIT"
    mkdir -p "$RUNTIME" "$RAMDISK_EDIT"
    7z e -y "$ISO" -o"$RUNTIME" kernel initrd.img ramdisk.img system.sfs >/dev/null
  fi

  if [ ! -s "$RAMDISK_EDIT/init" ]; then
    gzip -dc "$RUNTIME/ramdisk.img" | (cd "$RAMDISK_EDIT" && cpio -idm --no-absolute-filenames >/dev/null)
  fi

  cp "$ADB_KEY_FILE" "$RAMDISK_EDIT/adb_keys"
  chmod 600 "$RAMDISK_EDIT/adb_keys"
  if grep -q '^ro.adb.secure=' "$RAMDISK_EDIT/default.prop"; then
    sed -i 's/^ro.adb.secure=.*/ro.adb.secure=1/' "$RAMDISK_EDIT/default.prop"
  else
    printf '%s\n' 'ro.adb.secure=1' >> "$RAMDISK_EDIT/default.prop"
  fi
  if grep -q '^ro.secure=' "$RAMDISK_EDIT/default.prop"; then
    sed -i 's/^ro.secure=.*/ro.secure=0/' "$RAMDISK_EDIT/default.prop"
  else
    printf '%s\n' 'ro.secure=0' >> "$RAMDISK_EDIT/default.prop"
  fi

  if ! grep -q '^import /init.omnikali-cloud.rc$' "$RAMDISK_EDIT/init.rc"; then
    sed -i '1i import /init.omnikali-cloud.rc' "$RAMDISK_EDIT/init.rc"
  fi

  cat > "$RAMDISK_EDIT/init.omnikali-cloud.rc" <<'EOF'
on boot
    setprop service.adb.tcp.port 5555
    setprop persist.adb.tcp.port 5555
    setprop service.adb.root 1
    setprop persist.service.adb.enable 1

on post-fs-data
    stop adbd
    start adbd

on property:sys.boot_completed=1
    setprop service.adb.tcp.port 5555
    setprop persist.adb.tcp.port 5555
    setprop service.adb.root 1
    setprop persist.service.adb.enable 1
    restart adbd
EOF
  chmod 644 "$RAMDISK_EDIT/init.omnikali-cloud.rc"

  rm -f "$RUNTIME/ramdisk-cloud.img.tmp"
  (cd "$RAMDISK_EDIT" && find . -print0 | cpio --null -o -H newc 2>/dev/null | gzip -9 > "$RUNTIME/ramdisk-cloud.img.tmp")
  mv "$RUNTIME/ramdisk-cloud.img.tmp" "$RUNTIME/ramdisk-cloud.img"

  if [ ! -f "$DATA" ]; then
    truncate -s "$DATA_SIZE" "$DATA"
    mkfs.ext4 -F "$DATA" >"$LOG_DIR/mkfs.log" 2>&1
  fi
  chmod 600 "$DATA"

  echo "PASS: cloud Android artifacts prepared"
  echo "iso_sha256=$actual"
  echo "data=$DATA"
  echo "ramdisk=$RUNTIME/ramdisk-cloud.img"
}

start() {
  prepare
  if ! alive; then
  rm -f "$QEMU_PID" "$TOKEN_MAP" "$TOKEN_FILE" "$URL_FILE"
  "$QEMU_BIN" \
    -name omnikali-cloud-android \
    -enable-kvm -m "$MEMORY_MB" -smp "$CPUS" -cpu host \
    -kernel "$RUNTIME/kernel" -initrd "$RUNTIME/initrd.img" \
    -append 'root=/dev/ram0 androidboot.selinux=permissive androidboot.hardware=android_x86_64 console=ttyS0 RAMDISK=vdb DATA=vdc SETUPWIZARD=0 androidboot.qemu=1 nomodeset HWACCEL=0' \
    -drive index=0,if=virtio,id=system,file="$RUNTIME/system.sfs",format=raw,readonly=on \
    -drive index=1,if=virtio,id=ramdisk,file="$RUNTIME/ramdisk-cloud.img",format=raw,readonly=on \
    -drive index=2,if=virtio,id=data,file="$DATA",format=raw \
    -netdev user,id=net0,hostfwd=tcp:"$LISTEN_ADDR":"$ADB_PORT"-:5555 \
    -device virtio-net-pci,netdev=net0 \
    -device qemu-xhci,id=xhci -device usb-tablet,bus=xhci.0 \
    -vga std -vnc "$LISTEN_ADDR:3" \
    -daemonize -pidfile "$QEMU_PID" \
    >"$LOG_DIR/qemu.log" 2>&1

  sleep 2
  alive || { cat "$LOG_DIR/qemu.log" >&2; fail "cloud Android QEMU exited"; }
  fi

  if [ ! -s "$TOKEN_FILE" ]; then
    token="$(openssl rand -hex 32)"
    printf '%s: %s:%s\n' "$token" "$LISTEN_ADDR" "$VNC_PORT" > "$TOKEN_MAP"
    printf '%s\n' "$token" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_MAP" "$TOKEN_FILE"
  else
    token="$(cat "$TOKEN_FILE")"
    printf '%s: %s:%s\n' "$token" "$LISTEN_ADDR" "$VNC_PORT" > "$TOKEN_MAP"
    chmod 600 "$TOKEN_MAP"
  fi

  if ! ws_alive; then
    "$WEBSOCKIFY_BIN" --token-plugin TokenFile --token-source "$TOKEN_MAP" \
      --web "$WEB_ROOT" --heartbeat 30 "$LISTEN_ADDR:$WS_PORT" \
      >"$LOG_DIR/websockify.log" 2>&1 &
    echo $! > "$WS_PID"
  fi

  path="websockify?token=$token"
  encoded="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$path")"
  printf '/vnc.html?autoconnect=true&reconnect=true&reconnect_delay=1500&resize=scale&path=%s\n' "$encoded" > "$URL_FILE"
  chmod 600 "$URL_FILE"

  sleep 2
  kill -0 "$(cat "$WS_PID")" 2>/dev/null || fail "websockify exited"
  echo "PASS: cloud Android VM and token-gated screen transport are running"
  status
}

stop() {
  if alive; then kill "$(cat "$QEMU_PID")" 2>/dev/null || true; fi
  rm -f "$QEMU_PID"
  if [ -s "$WS_PID" ]; then kill "$(cat "$WS_PID")" 2>/dev/null || true; fi
  rm -f "$WS_PID" "$TOKEN_MAP" "$TOKEN_FILE" "$URL_FILE"
  echo "PASS: cloud Android transport stopped"
}

status() {
  if alive; then echo "qemu=RUNNING pid=$(cat "$QEMU_PID")"; else echo "qemu=STOPPED"; fi
  [ -s "$TOKEN_FILE" ] && echo "token=PRESENT" || echo "token=ABSENT"
  [ -s "$URL_FILE" ] && echo "url_file=$URL_FILE"
  ws_alive && echo "websockify=RUNNING pid=$(cat "$WS_PID")" || echo "websockify=STOPPED"
  ss -ltn 2>/dev/null | grep -E "127.0.0.1:($VNC_PORT|$WS_PORT|$ADB_PORT)\b" || true
}

adb_cmd() {
  command -v adb >/dev/null || fail "adb is required on the control host"
  adb connect "$LISTEN_ADDR:$ADB_PORT"
  adb -s "$LISTEN_ADDR:$ADB_PORT" "$@"
}

arg="${1-status}"
case "$arg" in
  prepare) prepare ;;
  start) start ;;
  stop) stop ;;
  status) status ;;
  restart) stop || true; start ;;
  adb) shift; adb_cmd "$@" ;;
  *) echo "Usage: $0 {prepare|start|stop|status|restart|adb ...}" >&2; exit 64 ;;
esac
