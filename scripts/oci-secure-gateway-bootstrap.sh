#!/usr/bin/env bash
set -Eeuo pipefail

# Fail-closed OCI browser gateway for the isolated Grasshopper workstation.
# This script is intentionally unusable until an OAuth provider and HTTPS
# hostname are explicitly configured. It never modifies AWS/Helix/Kali.

: "${GRASSHOPPER_AUTH_DOMAIN:?Set GRASSHOPPER_AUTH_DOMAIN, e.g. your controlled HTTPS hostname}"
: "${GRASSHOPPER_OAUTH_CLIENT_ID:?Set the OAuth client ID}"
: "${GRASSHOPPER_OAUTH_CLIENT_SECRET:?Set the OAuth client secret}"

PROVIDER="${GRASSHOPPER_AUTH_PROVIDER:-github}"
ALLOWED_GITHUB_USER="${GRASSHOPPER_GITHUB_USER:-onnxscibroccoli}"
COOKIE_SECRET="${GRASSHOPPER_COOKIE_SECRET:-}"
AUTH_DOMAIN="$GRASSHOPPER_AUTH_DOMAIN"
CALLBACK="https://$AUTH_DOMAIN/oauth2/callback"

if [[ -z "$COOKIE_SECRET" ]]; then
  COOKIE_SECRET="$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')"
fi

case "$PROVIDER" in
  github|google|oidc) ;;
  *) echo "ERROR: unsupported provider: $PROVIDER" >&2; exit 2 ;;
esac

echo "=== Grasshopper OCI AUTH GATEWAY ==="
echo "Provider: $PROVIDER"
echo "Domain:   $AUTH_DOMAIN"
echo "Callback: $CALLBACK"

sudo dnf -y install nginx openssl curl tar gzip policycoreutils-python-utils certbot python3-certbot-nginx

ARCH="$(uname -m)"
case "$ARCH" in
  aarch64) OAUTH_ARCH="arm64" ;;
  x86_64) OAUTH_ARCH="amd64" ;;
  *) echo "ERROR: unsupported architecture: $ARCH" >&2; exit 3 ;;
esac

OAUTH_VERSION="7.15.4"
OAUTH_URL="https://github.com/oauth2-proxy/oauth2-proxy/releases/download/v${OAUTH_VERSION}/oauth2-proxy-v${OAUTH_VERSION}.linux-${OAUTH_ARCH}.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$OAUTH_URL" -o "$TMP/oauth2-proxy.tgz"
tar -xzf "$TMP/oauth2-proxy.tgz" -C "$TMP"
sudo install -m 0755 "$TMP/oauth2-proxy-v${OAUTH_VERSION}.linux-${OAUTH_ARCH}/oauth2-proxy" /usr/local/bin/oauth2-proxy

sudo install -d -m 0750 -o root -g nginx /etc/grasshopper
sudo tee /etc/grasshopper/oauth2-proxy.cfg >/dev/null <<CFG
provider = "$PROVIDER"
http_address = "127.0.0.1:4180"
reverse_proxy = true
trusted_proxy_ips = ["127.0.0.1/32", "::1/128"]
redirect_url = "$CALLBACK"
client_id = "$GRASSHOPPER_OAUTH_CLIENT_ID"
client_secret = "$GRASSHOPPER_OAUTH_CLIENT_SECRET"
cookie_secret = "$COOKIE_SECRET"
cookie_secure = true
cookie_httponly = true
cookie_samesite = "lax"
cookie_name = "__Host-grasshopper_auth"
cookie_expire = "8h"
cookie_refresh = "1h"
session_cookie_minimal = true
skip_provider_button = false
proxy_websockets = true
upstreams = ["http://127.0.0.1:6080/"]
CFG

if [[ "$PROVIDER" == "github" ]]; then
  printf 'github_user = ["%s"]\n' "$ALLOWED_GITHUB_USER" | sudo tee -a /etc/grasshopper/oauth2-proxy.cfg >/dev/null
fi

sudo chmod 0640 /etc/grasshopper/oauth2-proxy.cfg
sudo chown root:nginx /etc/grasshopper/oauth2-proxy.cfg

sudo /usr/local/bin/oauth2-proxy --config=/etc/grasshopper/oauth2-proxy.cfg --config-test

sudo tee /etc/systemd/system/grasshopper-oauth2-proxy.service >/dev/null <<UNIT
[Unit]
Description=Grasshopper OAuth2 authenticated desktop gateway
After=network-online.target grasshopper-novnc.service
Wants=network-online.target
Requires=grasshopper-novnc.service

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/oauth2-proxy --config=/etc/grasshopper/oauth2-proxy.cfg
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=/etc/grasshopper
CapabilityBoundingSet=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
LockPersonality=true
MemoryDenyWriteExecute=true

[Install]
WantedBy=multi-user.target
UNIT

# Obtain a normal public certificate. HTTP is used only for ACME and then
# redirects permanently to HTTPS. The desktop itself is never served on HTTP.
sudo systemctl enable --now nginx
sudo certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email   --redirect --keep-until-expiring -d "$AUTH_DOMAIN"

sudo tee /etc/nginx/nginx.conf >/dev/null <<NGINX
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

events { worker_connections 1024; }

http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  access_log /var/log/nginx/access.log;
  sendfile on;
  keepalive_timeout 65;

  map $http_upgrade $connection_upgrade {
    default upgrade;
    "" close;
  }

  server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name $AUTH_DOMAIN;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name $AUTH_DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$AUTH_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$AUTH_DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "same-origin" always;

    location /oauth2/ {
      proxy_pass http://127.0.0.1:4180;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto https;
      proxy_set_header X-Forwarded-Host $host;
      proxy_set_header X-Forwarded-Uri $request_uri;
    }

    location / {
      auth_request /oauth2/auth;
      error_page 401 = @oauth2_signin;

      proxy_pass http://127.0.0.1:6080;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection $connection_upgrade;
      proxy_read_timeout 86400;
      proxy_send_timeout 86400;
    }

    location = /oauth2/auth {
      proxy_pass http://127.0.0.1:4180/oauth2/auth;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-Uri $request_uri;
      proxy_set_header Content-Length "";
      proxy_pass_request_body off;
    }

    location @oauth2_signin {
      return 302 /oauth2/start?rd=https://$host$request_uri;
    }

    location ~ /\\. {
      deny all;
    }
  }
}
NGINX

sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now grasshopper-oauth2-proxy.service
sudo systemctl restart nginx

# The authenticated edge is now the only public desktop path. VNC and
# websockify remain loopback-only.
ss -lnt | grep -q '127.0.0.1:5901'
ss -lnt | grep -q '127.0.0.1:6080'
ss -lnt | grep -q '0.0.0.0:443'

echo "=== AUTH GATEWAY SELF-TEST: PASS ==="
echo "Unauthenticated requests must redirect to OAuth."
echo "Desktop upstream remains localhost-only."
echo "Callback: $CALLBACK"
