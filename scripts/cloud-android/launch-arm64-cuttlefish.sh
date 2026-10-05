#!/usr/bin/env bash
set -euo pipefail

: "${CF_HOME:=/srv/grasshopper/android/cuttlefish}"
: "${CF_IMAGES:=$CF_HOME/images}"
: "${CF_INSTANCE:=cloud-android}"

fail(){ echo "FAIL:$*" >&2; exit 1; }

[[ "$(uname -m)" == "aarch64" ]] || fail "ARM64 host required"
[[ -r /dev/kvm && -w /dev/kvm ]] || fail "KVM unavailable"
[[ -x "$CF_HOME/bin/launch_cvd" ]] || fail "Cuttlefish host package missing at $CF_HOME"
[[ -d "$CF_IMAGES" ]] || fail "Cuttlefish images missing at $CF_IMAGES"

mkdir -p "$CF_HOME/runtime/$CF_INSTANCE"
cd "$CF_HOME"
export HOME="$CF_HOME/runtime/$CF_INSTANCE"

exec "$CF_HOME/bin/launch_cvd" --daemon --start_webrtc --instance_num=1
