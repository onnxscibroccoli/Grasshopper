#!/usr/bin/env bash
set -euo pipefail
install -d -m 0750 /etc/grasshopper-mcp
install -m 0755 /srv/grasshopper/mcp_server.py /srv/grasshopper/mcp_server.py
if [ ! -s /etc/grasshopper-mcp/token ]; then
  umask 077
  python3 -c 'import secrets; print(secrets.token_urlsafe(48))' > /etc/grasshopper-mcp/token
fi
chown root:grasshopper /etc/grasshopper-mcp/token
chmod 0640 /etc/grasshopper-mcp/token
install -m 0644 /srv/grasshopper/android/development/arm64-native-build/infra/oci/mcp/grasshopper-mcp.service /etc/systemd/system/grasshopper-mcp.service
systemctl daemon-reload
systemctl enable --now grasshopper-mcp.service
