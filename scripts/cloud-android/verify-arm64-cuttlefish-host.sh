#!/usr/bin/env bash
set -euo pipefail

fail(){ echo "FAIL:$*" >&2; exit 1; }
pass(){ echo "PASS:$*"; }

arch="$(uname -m)"
[[ "$arch" == "aarch64" ]] || fail "host-architecture=$arch expected=aarch64"
pass "host-architecture=aarch64"

[[ -e /dev/kvm ]] || fail "kvm-device-missing"
[[ -r /dev/kvm && -w /dev/kvm ]] || fail "kvm-device-not-readable-writable"
pass "kvm-device=available"

command -v adb >/dev/null || fail "adb-missing"
pass "adb=present"

if [[ -x "${CF_HOME:-}/bin/launch_cvd" ]]; then
  pass "cuttlefish-launcher=present"
elif command -v launch_cvd >/dev/null; then
  pass "cuttlefish-launcher=present"
else
  fail "cuttlefish-launcher-missing"
fi

echo "ARM64_CUTTLEFISH_HOST=PASS"
