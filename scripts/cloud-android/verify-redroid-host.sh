#!/usr/bin/env bash
set -euo pipefail
failures=0
emit(){ printf '%s=%s\n' "$1" "$2"; }
fail(){ emit "$1" FAIL; failures=$((failures+1)); }
arch="$(uname -m)"; emit ARCH "$arch"
case "$arch" in aarch64|x86_64) ;; *) fail ARCH_SUPPORTED;; esac
runtime=""
command -v docker >/dev/null 2>&1 && runtime=docker
if [[ -z "$runtime" ]] && command -v podman >/dev/null 2>&1; then runtime=podman; fi
[[ -n "$runtime" ]] && emit CONTAINER_RUNTIME "$runtime" || fail CONTAINER_RUNTIME
config="/boot/config-$(uname -r)"
binder_config=unknown
if [[ -r "$config" ]]; then
  grep -Eq '^CONFIG_ANDROID_BINDER_IPC=[ym]' "$config" && binder_config=enabled || true
  grep -Eq '^# CONFIG_ANDROID_BINDER_IPC is not set$' "$config" && binder_config=disabled || true
fi
emit BINDER_KERNEL_CONFIG "$binder_config"
[[ "$binder_config" == enabled ]] || fail BINDER_KERNEL_CONFIG
if [[ -c /dev/binder || -c /dev/hwbinder || -c /dev/vndbinder ]]; then emit BINDER_DEVICE PASS; else fail BINDER_DEVICE; fi
if [[ -d /dev/binderfs ]] || find /sys/fs -maxdepth 2 -type d -name binderfs -print -quit 2>/dev/null | grep -q .; then emit BINDERFS PASS; else fail BINDERFS; fi
[[ -e /proc/pressure/memory ]] && emit PSI_MEMORY PASS || fail PSI_MEMORY
if [[ "$arch" == aarch64 ]]; then
  pages="$(getconf PAGESIZE 2>/dev/null || true)"; emit PAGE_SIZE "$pages"
  [[ "$pages" == 4096 ]] || fail PAGE_SIZE_4K
fi
if ((failures==0)); then emit REDROID_HOST PASS; exit 0; fi
emit REDROID_HOST FAIL
emit REMEDIATION "Use a host kernel with Android Binder/BinderFS and PSI enabled; do not silently substitute KVM or TCG."
exit 1
