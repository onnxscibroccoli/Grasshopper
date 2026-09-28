#!/bin/sh
set -eu
mkdir -p /home/kali/.mozilla/omnikali
chown -R kali:kali /home/kali 2>/dev/null || true
chmod -R a+rwX /home/kali 2>/dev/null || true
test -w /home/kali || { echo "workspace is not writable by desktop container" >&2; exit 1; }
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/omnikali.conf
