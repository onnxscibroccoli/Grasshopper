#!/usr/bin/env bash
set -euo pipefail
: "${REDROID_IMAGE:?Set REDROID_IMAGE to a verified redroid image}"
: "${REDROID_DATA:=/srv/grasshopper/android/redroid-data}"
: "${REDROID_NAME:=grasshopper-redroid}"
: "${REDROID_ADB_PORT:=5555}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/verify-redroid-host.sh"
runtime="${REDROID_RUNTIME:-}"
if [[ -z "$runtime" ]]; then
  command -v docker >/dev/null 2>&1 && runtime=docker || true
  [[ -n "$runtime" ]] || { command -v podman >/dev/null 2>&1 && runtime=podman || true; }
fi
[[ -n "$runtime" ]] || { echo "FAIL: no supported container runtime" >&2; exit 1; }
mkdir -p "$REDROID_DATA"
exec "$runtime" run -d --rm --name "$REDROID_NAME" --privileged \
  -v "$REDROID_DATA:/data" \
  -p "127.0.0.1:${REDROID_ADB_PORT}:5555" \
  "$REDROID_IMAGE" \
  androidboot.redroid_gpu_mode="${REDROID_GPU_MODE:-guest}"
