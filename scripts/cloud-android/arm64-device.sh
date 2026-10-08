#!/usr/bin/env bash
set -Eeuo pipefail

STATE_DIR="${CLOUD_ANDROID_ARM64_STATE_DIR:-$HOME/.cloud-android-arm64}"
CONTAINER="${CLOUD_ANDROID_ARM64_CONTAINER:-grasshopper-cloud-android-arm64}"
PODMAN_ROOT="${CLOUD_ANDROID_PODMAN_ROOT:-/srv/grasshopper/android/development/qemu-container-store}"
IMAGE="${CLOUD_ANDROID_ARM64_IMAGE:-docker.io/library/alpine:3.22}"
MEMORY_MB="${CLOUD_ANDROID_ARM64_MEMORY_MB:-1536}"
CPUS="${CLOUD_ANDROID_ARM64_CPUS:-2}"
VNC_PORT="${CLOUD_ANDROID_ARM64_VNC_PORT:-5906}"
WS_PORT="${CLOUD_ANDROID_ARM64_WS_PORT:-6083}"
ADB_PORT="${CLOUD_ANDROID_ARM64_ADB_PORT:-16555}"
LISTEN_ADDR="${CLOUD_ANDROID_ARM64_LISTEN_ADDR:-127.0.0.1}"
PUBLIC_BASE="${CLOUD_ANDROID_ARM64_PUBLIC_BASE_URL:-}"
RELEASE="v2026.07.09"
ARCHIVE_NAME="UTM-VM-lineage-23.2-20260709-jqssun-virtio_arm64only.zip"
ARCHIVE_URL="https://github.com/jqssun/android-lineage-qemu/releases/download/${RELEASE}/${ARCHIVE_NAME}"
ARCHIVE_SHA256="55dcf50038de1ad460a680d82146294151c9301084c4b88c7ddc0323bade5e53"
ARCHIVE="$STATE_DIR/$ARCHIVE_NAME"
TOKEN_FILE="$STATE_DIR/current-token"
TOKEN_MAP="$STATE_DIR/token-map"
URL_FILE="$STATE_DIR/session-url"
LOG_DIR="$STATE_DIR/logs"
RUN_DIR="$STATE_DIR/run"
VM_DIR="$STATE_DIR/LineageOS_on_arm64.utm"
VDA="$VM_DIR/Data/vda.qcow2"
VDB="$VM_DIR/Data/vdb.qcow2"
EFI_VARS="$RUN_DIR/flash_vars.fd"

fail() { echo "ERROR: $*" >&2; exit 2; }
podman_cmd() { podman --root "$PODMAN_ROOT" "$@"; }

require_tools() {
  command -v podman >/dev/null || fail "podman is required"
  command -v curl >/dev/null || fail "curl is required"
  command -v sha256sum >/dev/null || fail "sha256sum is required"
  command -v openssl >/dev/null || fail "openssl is required"
  command -v unzip >/dev/null || fail "unzip is required"
  [ -d "$PODMAN_ROOT" ] || fail "Podman root does not exist: $PODMAN_ROOT"
}

prepare() {
  require_tools
  mkdir -p "$STATE_DIR" "$LOG_DIR" "$RUN_DIR"
  chmod 700 "$STATE_DIR" "$LOG_DIR" "$RUN_DIR"

  if [ ! -s "$ARCHIVE" ]; then
    curl -L --fail --retry 3 -o "$ARCHIVE.tmp" "$ARCHIVE_URL"
    mv "$ARCHIVE.tmp" "$ARCHIVE"
  fi

  actual="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
  [ "$actual" = "$ARCHIVE_SHA256" ] || fail "LineageOS archive SHA-256 mismatch: $actual"

  if [ ! -s "$VDA" ] || [ ! -s "$VDB" ]; then
    rm -rf "$VM_DIR"
    unzip -q -o "$ARCHIVE" -d "$STATE_DIR"
  fi

  [ -s "$VDA" ] || fail "missing ARM64 LineageOS vda.qcow2"
  [ -s "$VDB" ] || fail "missing ARM64 LineageOS vdb.qcow2"

  if [ ! -s "$EFI_VARS" ]; then
    unzip -p "$ARCHIVE" LineageOS_on_arm64.utm/Data/efi_vars.fd > "$EFI_VARS.tmp"
    truncate -s 64M "$EFI_VARS.tmp"
    mv "$EFI_VARS.tmp" "$EFI_VARS"
  fi

  [ -s "$EFI_VARS" ] || fail "missing ARM64 EFI variables from upstream image"
  [ "$(stat -c '%s' "$EFI_VARS")" = "67108864" ] || fail "ARM64 EFI variable store must be 64 MiB for QEMU pflash"

  printf '%s\n' "prepared_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$STATE_DIR/PREPARED"
  printf '%s\n' "release=$RELEASE" >> "$STATE_DIR/PREPARED"
  printf '%s\n' "archive_sha256=$actual" >> "$STATE_DIR/PREPARED"
  printf '%s\n' "host_arch=$(uname -m)" >> "$STATE_DIR/PREPARED"
  echo "PASS: ARM64 Cloud Android artifacts prepared"
}

start() {
  prepare
  if podman_cmd container exists "$CONTAINER"; then
    podman_cmd rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi

  token="$(openssl rand -hex 32 2>/dev/null || true)"
  [ -n "$token" ] || fail "openssl is required for session tokens"
  printf '%s\n' "$token" > "$TOKEN_FILE"
  printf '%s: 127.0.0.1:5906\n' "$token" > "$TOKEN_MAP"
  chmod 600 "$TOKEN_FILE" "$TOKEN_MAP"

  podman_cmd run -d --name "$CONTAINER" --network host \
    -v "$STATE_DIR:/state:Z" \
    -e CLOUD_ANDROID_MEMORY_MB="$MEMORY_MB" \
    -e CLOUD_ANDROID_CPUS="$CPUS" \
    "$IMAGE" \
    sh -ec '
      apk add --no-cache qemu-system-aarch64 qemu-hw-display-virtio-gpu-pci websockify novnc >/dev/null
      qemu-system-aarch64 \
        -name grasshopper-cloud-android-arm64 \
        -machine virt,gic-version=max \
        -cpu max \
        -accel tcg,thread=multi,tb-size=1024 \
        -smp "$CLOUD_ANDROID_CPUS" -m "$CLOUD_ANDROID_MEMORY_MB" \
        -drive if=pflash,format=raw,unit=0,file=/usr/share/qemu/edk2-aarch64-code.fd,readonly=on \
        -drive if=pflash,format=raw,unit=1,file=/state/run/flash_vars.fd \
        -drive if=none,id=vda,file=/state/LineageOS_on_arm64.utm/Data/vda.qcow2,format=qcow2,discard=unmap,detect-zeroes=unmap \
        -device virtio-blk-pci,drive=vda,bootindex=0 \
        -drive if=none,id=vdb,file=/state/LineageOS_on_arm64.utm/Data/vdb.qcow2,format=qcow2,discard=unmap,detect-zeroes=unmap \
        -device virtio-blk-pci,drive=vdb,bootindex=1 \
        -netdev user,id=net0,hostfwd=tcp:127.0.0.1:16555-:5555 \
        -device virtio-net-pci,netdev=net0 \
        -device virtio-rng-pci \
        -device qemu-xhci,id=xhci \
        -device usb-kbd,bus=xhci.0 \
        -device usb-tablet,bus=xhci.0 \
        -device virtio-gpu-pci \
        -vnc 127.0.0.1:6 \
        -serial file:/state/run/serial.log \
        -monitor unix:/state/run/mon.sock,server=on,wait=off \
        > /state/logs/qemu.log 2>&1 &
      qemu_pid=$!
      printf "%s\n" "$qemu_pid" > /state/run/qemu-container-pid
      websockify --token-plugin TokenFile --token-source /state/token-map \
        --web /usr/share/novnc --heartbeat 30 127.0.0.1:6083 \
        > /state/logs/websockify.log 2>&1 &
      ws_pid=$!
      printf "%s\n" "$ws_pid" > /state/run/websockify-container-pid
      wait "$qemu_pid"
    '

  sleep 5
  podman_cmd ps --filter "name=^/$CONTAINER$" --format '{{.Names}} {{.Status}}'
  podman_cmd exec "$CONTAINER" sh -c 'test -s /state/run/serial.log && tail -20 /state/run/serial.log || true'

  path="websockify?token=$token"
  printf '%s/vnc.html?autoconnect=true&reconnect=true&reconnect_delay=1500&resize=scale&path=%s\n' "${PUBLIC_BASE%/}" "$path" > "$URL_FILE"
  chmod 600 "$URL_FILE"
  echo "PASS: ARM64 Cloud Android QEMU, VNC and token-gated WebSocket transport started"
  status
}

stop() {
  podman_cmd rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -f "$TOKEN_FILE" "$TOKEN_MAP" "$URL_FILE"
  echo "PASS: ARM64 Cloud Android stopped"
}

status() {
  if podman_cmd ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "container=RUNNING name=$CONTAINER"
  else
    echo "container=STOPPED name=$CONTAINER"
  fi
  [ -s "$TOKEN_FILE" ] && echo "token=PRESENT" || echo "token=ABSENT"
  [ -s "$URL_FILE" ] && echo "url_file=$URL_FILE"
  ss -ltn 2>/dev/null | grep -E "127.0.0.1:($VNC_PORT|$WS_PORT|$ADB_PORT)\b" || true
}

case "${1-status}" in
  prepare) prepare ;;
  start) start ;;
  stop) stop ;;
  restart) stop || true; start ;;
  status) status ;;
  *) echo "Usage: $0 {prepare|start|stop|restart|status}" >&2; exit 64 ;;
esac
