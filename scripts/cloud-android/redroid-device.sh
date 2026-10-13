#!/usr/bin/env bash
# Redroid on OCI. No OCI API, QEMU, nginx, or unrelated container mutations.
set -Eeuo pipefail
umask 077
NAME=grasshopper-redroid
IMAGE=redroid/redroid:16.0.0_64only-latest
DATA=/srv/grasshopper/redroid-data
BACKUPS=/srv/grasshopper/redroid-snapshots
PORT=5556
MEMORY_MB=3072
RESERVE_MB=2048
DISK_MIN_MB=8192
die() { printf 'BLOCKED: %s\n' "$*" >&2; exit 75; }
runtime() {
  if command -v podman >/dev/null 2>&1; then RUNNER=podman
  elif command -v docker >/dev/null 2>&1; then RUNNER=docker
  else RUNNER=none; fi
}
running() {
  [[ "$RUNNER" != none ]] && [[ "$("$RUNNER" inspect --format '{{.State.Running}}' "$NAME" 2>/dev/null || :)" == true ]]
}
exists() { [[ "$RUNNER" != none ]] && "$RUNNER" container inspect "$NAME" >/dev/null 2>&1; }
qemu_running() { ps -eo comm= | grep -Eq '^qemu-system-'; }
mem_mb() { awk '/^MemAvailable:/ {printf "%d\n", $2 / 1024; exit}' /proc/meminfo; }
disk_mb() { df -Pm /srv/grasshopper | awk 'NR==2 {print $4}'; }
status() {
  runtime
  printf 'host=%s kernel=%s arch=%s runtime=%s\n' "$(hostname)" "$(uname -r)" "$(uname -m)" "$RUNNER"
  printf 'container=%s adb=127.0.0.1:%s data=%s\n' "$NAME" "$PORT" "$DATA"
  printf 'available_mb=%s old_qemu=%s\n' "$(mem_mb)" "$(qemu_running && echo yes || echo no)"
  if [[ -d /srv/grasshopper ]]; then printf 'persistent_disk_free_mb=%s\n' "$(disk_mb)"; fi
  for d in binder hwbinder vndbinder ashmem; do
    if [[ -e "/dev/$d" ]]; then printf '%s=present\n' "$d"; else printf '%s=missing\n' "$d"; fi
  done
  if running; then
    printf 'redroid=RUNNING\n'
    local boot version
    boot=$(timeout 8 "$RUNNER" exec "$NAME" getprop sys.boot_completed 2>/dev/null | tr -d '\r' || :)
    version=$(timeout 8 "$RUNNER" exec "$NAME" getprop ro.build.version.release 2>/dev/null | tr -d '\r' || :)
    printf 'boot_completed=%s android_version=%s\n' "$boot" "$version"
  elif exists; then echo 'redroid=STOPPED'
  else echo 'redroid=ABSENT'; fi
}
preflight() {
  runtime
  [[ "$(uname -m)" == aarch64 ]] || die 'host is not aarch64'
  [[ "$RUNNER" != none ]] || die 'no supported container runtime found'
  "$RUNNER" info >/dev/null 2>&1 || die "cannot access $RUNNER"
  [[ "$RUNNER" != podman || "$(id -u)" == 0 ]] || die 'rootful Podman service is required for production Binder access'
  local store
  if [[ "$RUNNER" == podman ]]; then
    store=$("$RUNNER" info --format '{{.Store.GraphRoot}}' 2>/dev/null || :)
  else
    store=$("$RUNNER" info --format '{{.DockerRootDir}}' 2>/dev/null || :)
  fi
  [[ -n "$store" && "$(realpath -m -- "$store")" == /srv/grasshopper/* ]] ||
    die "container image store is not on persistent /srv/grasshopper; current=$store"
  [[ -d /srv/grasshopper && -w /srv/grasshopper ]] || die 'persistent volume unavailable'
  [[ "$(realpath -m -- "$DATA")" == /srv/grasshopper/* ]] || die 'unsafe data path'
  [[ "$(realpath -m -- "$BACKUPS")" == /srv/grasshopper/* ]] || die 'unsafe snapshot path'
  for d in binder hwbinder vndbinder; do
    [[ -c "/dev/$d" ]] || die "missing Binder device /dev/$d"
  done
  qemu_running && die 'existing QEMU guest is active; do not compete for memory or replace it'
  if exists; then
    if running; then echo 'PASS: existing redroid container running'; return 0; fi
    die 'stopped redroid exists; inspect manually, no implicit replacement'
  fi
  command -v ss >/dev/null || die 'ss required for port validation'
  if ss -H -ltn | awk '{print $4}' | grep -Eq '(^|:)5556$'; then die 'ADB port already occupied'; fi
  local available free
  available=$(mem_mb)
  free=$(disk_mb)
  [[ "$available" =~ ^[0-9]+$ && "$free" =~ ^[0-9]+$ ]] || die 'resource measurements unavailable'
  (( available >= MEMORY_MB + RESERVE_MB )) || die "memory admission failed: available=$available MB; required=5120 MB"
  (( free >= DISK_MIN_MB )) || die "disk admission failed: free=$free MB; required=$DISK_MIN_MB MB"
  echo 'PASS: redroid local host preflight'
}
start() {
  preflight
  if running; then echo 'PASS: already running'; return; fi
  [[ "$(printenv REDROID_APPROVE_LOCAL_START 2>/dev/null || :)" == 1 ]] || die 'explicit start approval env var required'
  mkdir -p "$DATA" "$BACKUPS"
  chmod 700 "$DATA" "$BACKUPS"
  "$RUNNER" pull "$IMAGE"
  "$RUNNER" run -d --name "$NAME" --privileged \
    --restart=unless-stopped --memory 3072m --cpus 1 \
    -p "127.0.0.1:$PORT:5555" -v "$DATA:/data:Z" \
    "$IMAGE" androidboot.use_memfd=1
  echo 'STARTED: verify Android 16 and boot_completed=1; ADB must remain loopback-only'
}
stop() {
  runtime
  exists || die 'named redroid container absent; refusing unrelated changes'
  "$RUNNER" stop --time 30 "$NAME"
  echo 'STOPPED: redroid only; /data remains'
}
snapshot() {
  runtime
  running && die 'stop redroid first; live /data snapshots refused'
  [[ -d "$DATA" ]] || die 'redroid data missing'
  [[ "$(realpath -m -- "$DATA")" == /srv/grasshopper/* ]] || die 'unsafe data path'
  [[ "$(realpath -m -- "$BACKUPS")" == /srv/grasshopper/* ]] || die 'unsafe backup path'
  mkdir -p "$BACKUPS"; chmod 700 "$BACKUPS"
  local output tmp
  output="$BACKUPS/$NAME-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
  tmp="$output.partial"
  [[ ! -e "$output" && ! -e "$tmp" ]] || die 'backup already exists'
  trap 'rm -f -- "$tmp"' EXIT
  tar --one-file-system -C "$DATA" -czf "$tmp" .
  tar -tzf "$tmp" >/dev/null
  chmod 600 "$tmp"
  mv -n -- "$tmp" "$output"
  trap - EXIT
  sha256sum "$output"
  echo "SNAPSHOT=$output (sensitive account sessions; never commit to Git)"
}
case "$1" in
  status) status ;;
  preflight) preflight ;;
  start) start ;;
  stop) stop ;;
  snapshot) snapshot ;;
  *) echo "Usage: $0 {status|preflight|start|stop|snapshot}" >&2; exit 64 ;;
esac
