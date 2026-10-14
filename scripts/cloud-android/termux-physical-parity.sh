#!/data/data/com.termux/files/usr/bin/bash
# Read-only physical Android 15 Termux parity. No APK installs or mutation.
set -Eeuo pipefail
umask 077
pass=0
fail=0
emit() {
  local label="$1" state="$2"
  printf '%s=%s\n' "$label" "$state"
  if [[ "$state" == PASS ]]; then ((pass+=1)); else ((fail+=1)); fi
  return 0
}
if [[ "${PREFIX:-}" != *com.termux* ]] && [[ "$PWD" != /data/data/com.termux/* ]]; then
  echo "BLOCKED=TERMUX_ENVIRONMENT_NOT_VERIFIED" >&2
  exit 2
fi
for tool in bash python git java javac adb; do
  if command -v "$tool" >/dev/null 2>&1; then emit "TERMUX_${tool}_INSTALLED" PASS
  else emit "TERMUX_${tool}_INSTALLED" NOT_PROVEN; fi
done
for tool in getprop cmd; do
  command -v "$tool" >/dev/null 2>&1 && emit "ANDROID_${tool}" PASS || emit "ANDROID_${tool}" NOT_PROVEN
done
sdk="$(getprop ro.build.version.sdk 2>/dev/null || true)"
abi="$(getprop ro.product.cpu.abi 2>/dev/null || true)"
model="$(getprop ro.product.model 2>/dev/null || true)"
[[ "$sdk" == 35 ]] && emit ANDROID15_API35 PASS || emit ANDROID15_API35 NOT_PROVEN
[[ "$abi" == arm64-v8a ]] && emit ANDROID_ARM64 PASS || emit ANDROID_ARM64 NOT_PROVEN
[[ "$model" == SM-A146U ]] && emit PHYSICAL_DEVICE_MODEL PASS || emit PHYSICAL_DEVICE_MODEL NOT_PROVEN
# Shizuku/Rish is independently verified and is not equivalent to root.
if command -v rish >/dev/null 2>&1; then
  if timeout 7 rish -c 'id -u' 2>/dev/null | grep -qx 2000; then
    emit RISH_SHELL_TRANSPORT PASS
  else emit RISH_SHELL_TRANSPORT NOT_PROVEN; fi
else emit RISH_SHELL_TRANSPORT NOT_PROVEN; fi
printf 'CHECKS_PASSED=%d\nCHECKS_NOT_PROVEN=%d\n' "$pass" "$fail"
echo 'CLOUD_ANDROID16_EQUIVALENCE=NOT_PROVEN'
echo 'LOCAL_BROWSER_INPUT=NOT_TESTED'
echo 'LOCAL_ACCESSIBILITY_SERVICE=NOT_TESTED'
echo 'PHYSICAL_DEVICE_APK_INSTALL=NOT_TESTED'
echo 'SENSITIVE_DATA_COLLECTED=NO'
(( fail==0 )) || exit 2
