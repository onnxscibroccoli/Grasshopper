#!/usr/bin/env bash
set -Ee -o pipefail

STATE_DIR="$HOME/.grasshopper/audit/cloud-android/stage0"
[ -n "$CLOUD_ANDROID_STATE_DIR" ] && STATE_DIR="$CLOUD_ANDROID_STATE_DIR"
BENCHMARK_REF="salvage/cloud-android-agentic-device-20261005"
[ -n "$CLOUD_ANDROID_BENCHMARK_REF" ] && BENCHMARK_REF="$CLOUD_ANDROID_BENCHMARK_REF"
REQUESTED_MB=1024
[ -n "$CLOUD_ANDROID_MEMORY_MB" ] && REQUESTED_MB="$CLOUD_ANDROID_MEMORY_MB"
RESERVE_MB=2048
[ -n "$CLOUD_ANDROID_HOST_RESERVE_MB" ] && RESERVE_MB="$CLOUD_ANDROID_HOST_RESERVE_MB"
OVERHEAD_MB=512
[ -n "$CLOUD_ANDROID_LAUNCH_OVERHEAD_MB" ] && OVERHEAD_MB="$CLOUD_ANDROID_LAUNCH_OVERHEAD_MB"
MIN_SWAP_FREE_MB=512
[ -n "$CLOUD_ANDROID_MIN_SWAP_FREE_MB" ] && MIN_SWAP_FREE_MB="$CLOUD_ANDROID_MIN_SWAP_FREE_MB"

mkdir -p "$STATE_DIR"
chmod 700 "$STATE_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$STATE_DIR/stage0-$STAMP.json"

mem_mb() { awk -v k="$1" '$1==k":" {print int($2/1024); exit}' /proc/meminfo; }

mem_total_mb="$(mem_mb MemTotal)"
mem_available_mb="$(mem_mb MemAvailable)"
swap_total_mb="$(mem_mb SwapTotal)"
swap_free_mb="$(mem_mb SwapFree)"

qemu_count=0
qemu_rss_kb=0
for pid in /proc/[0-9]*; do
  [ -r "$pid/cmdline" ] || continue
  cmd="$(tr "\0" " " < "$pid/cmdline" 2>/dev/null || true)"
  case "$cmd" in
    *qemu-system*|*qemu-kvm*)
      qemu_count=$((qemu_count+1))
      rss="$(awk '/^VmRSS:/ {print $2; exit}' "$pid/status" 2>/dev/null || echo 0)"
      qemu_rss_kb=$((qemu_rss_kb+rss))
      ;;
  esac
done

kvm="ABSENT"
[ -r /dev/kvm ] && kvm="PRESENT"
qemu_version="unavailable"
if command -v qemu-system-x86_64 >/dev/null 2>&1; then
  qemu_version="$(qemu-system-x86_64 --version 2>/dev/null | head -1 || true)"
fi

repo_root=""
if git rev-parse --show-toplevel >/dev/null 2>&1; then repo_root="$(git rev-parse --show-toplevel)"; fi
source_sha=""
if [ -n "$repo_root" ]; then source_sha="$(git -C "$repo_root" rev-parse HEAD 2>/dev/null || true)"; fi
benchmark_available=false
benchmark_sha=""
if [ -n "$repo_root" ]; then
  if git -C "$repo_root" show-ref --verify --quiet "refs/remotes/origin/$BENCHMARK_REF"; then
    benchmark_available=true
    benchmark_sha="$(git -C "$repo_root" rev-parse "refs/remotes/origin/$BENCHMARK_REF")"
  elif git -C "$repo_root" show-ref --verify --quiet "refs/heads/$BENCHMARK_REF"; then
    benchmark_available=true
    benchmark_sha="$(git -C "$repo_root" rev-parse "$BENCHMARK_REF")"
  fi
fi

required_mb=$((REQUESTED_MB+RESERVE_MB+OVERHEAD_MB))
available_after_launch_mb=$((mem_available_mb-REQUESTED_MB-OVERHEAD_MB))
admission="FAIL"
reason="insufficient_host_memory"
if [ "$mem_available_mb" -ge "$required_mb" ] && [ "$swap_free_mb" -ge "$MIN_SWAP_FREE_MB" ]; then
  admission="PASS"
  reason="resource_admission_satisfied"
elif [ "$swap_free_mb" -lt "$MIN_SWAP_FREE_MB" ]; then
  reason="insufficient_swap_reserve"
fi

transport="unavailable"
command -v adb >/dev/null 2>&1 && transport="adb-installed"
ss -ltn 2>/dev/null | grep -Eq '127\.0\.0\.1:5555\b' && transport="adb-listener-present"

cat > "$OUT" <<EOF
{
  "schema":"grasshopper.cloud-android-stage0/v1",
  "captured_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "stage":0,
  "environment":{
    "hostname":"$(hostname)",
    "kernel":"$(uname -srmo)",
    "repo_root":"$repo_root",
    "source_sha":"$source_sha",
    "benchmark_ref":"$BENCHMARK_REF",
    "benchmark_available":$benchmark_available,
    "benchmark_sha":"$benchmark_sha"
  },
  "capacity":{
    "cpu_count":$(nproc 2>/dev/null || echo 0),
    "mem_total_mb":$mem_total_mb,
    "mem_available_mb":$mem_available_mb,
    "swap_total_mb":$swap_total_mb,
    "swap_free_mb":$swap_free_mb,
    "requested_mb":$REQUESTED_MB,
    "host_reserve_mb":$RESERVE_MB,
    "launch_overhead_mb":$OVERHEAD_MB,
    "capacity_required_mb":$required_mb,
    "available_after_launch_mb":$available_after_launch_mb,
    "kvm":"$kvm",
    "qemu_version":"$qemu_version",
    "existing_qemu_count":$qemu_count,
    "existing_qemu_rss_mb":$((qemu_rss_kb/1024)),
    "admission":"$admission",
    "reason":"$reason"
  },
  "transport":{"status":"$transport","adb_installed":$(command -v adb >/dev/null 2>&1 && echo true || echo false)},
  "safety":{"live_sessions_modified":false,"new_qemu_started":false,"clean_state_created":true},
  "doorway_proven":false
}
EOF
ln -sfn "$OUT" "$STATE_DIR/latest.json"
cat "$OUT"

if [ "$admission" != "PASS" ]; then
  echo "STAGE0=BLOCKED: resource admission failed; no Cloud Android instance was started" >&2
  exit 75
fi
if [ "$benchmark_available" != true ]; then
  echo "STAGE0=BLOCKED: known-good benchmark ref is unavailable" >&2
  exit 76
fi
echo "STAGE0=ADMITTED: clean boot may proceed in disposable state"
