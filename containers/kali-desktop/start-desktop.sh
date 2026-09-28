#!/bin/sh
set -eu
mkdir -p /home/kali/.mozilla/omnikali
chown -R kali:kali /home/kali
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/omnikali.conf
