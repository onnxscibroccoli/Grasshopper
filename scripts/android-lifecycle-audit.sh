#!/data/data/com.termux/files/usr/bin/bash
set -u

echo "=== BROCCOLI ANDROID LIFECYCLE AUDIT ==="
echo "timestamp=$(date -Iseconds)"
echo

if pm list packages 2>/dev/null | grep -qx 'package:com.termux.boot'; then
  echo "TERMUX_BOOT_PACKAGE=PASS"
else
  echo "TERMUX_BOOT_PACKAGE=NOT_PROVEN"
fi

if [ -x "$HOME/.termux/boot/broccoli-supervisor" ]; then
  echo "BOOT_LAUNCHER=PASS"
else
  echo "BOOT_LAUNCHER=NOT_PROVEN"
fi

if command -v termux-wake-lock >/dev/null 2>&1; then
  echo "WAKE_LOCK_API=PASS"
else
  echo "WAKE_LOCK_API=NOT_PROVEN"
fi

if command -v rish >/dev/null 2>&1; then
  echo "RISH_EXECUTABLE=PASS"
else
  echo "RISH_EXECUTABLE=NOT_PROVEN"
fi

if [ -f "$HOME/broccoli-core/runtime-supervisor.pid" ] && kill -0 "$(cat "$HOME/broccoli-core/runtime-supervisor.pid" 2>/dev/null)" 2>/dev/null; then
  echo "SUPERVISOR=PASS"
else
  echo "SUPERVISOR=NOT_PROVEN"
fi

echo "BATTERY_OPTIMIZATION_EXEMPTION=NOT_PROVEN"
echo "ANDROID_FORCE_STOP_IMMUNITY=NOT_PROVEN"
echo "ANDROID_REBOOT_RECOVERY=NOT_PROVEN"
echo
echo "Security boundary: Android-side battery and force-stop state requires Android/privileged evidence."
