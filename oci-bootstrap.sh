#!/usr/bin/env bash
set -Eeuo pipefail

# Grasshopper OCI browser desktop bootstrap.
# Convergent entrypoint for an isolated OCI workstation.
# Never touches the protected AWS Helix/Kali production system.

REGION="${OCI_CLI_REGION:-us-ashburn-1}"
COMPARTMENT_NAME="Grasshopper"
INSTANCE_NAME="Grasshopper-Workstation"
SSH_USER="opc"
ROOT="$HOME/.grasshopper"
KEY="${GRASSHOPPER_OCI_SSH_KEY:-$ROOT/ssh/grasshopper_oci}"
REBUILD_URL="https://raw.githubusercontent.com/onnxscibroccoli/Grasshopper/main/scripts/oci-workstation-rebuild.sh"

die() { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

need oci
need ssh
need curl
need jq
[ -f /etc/oci/config ] || die "OCI Cloud Shell configuration not found"
export OCI_CLI_REGION="$REGION"

TENANCY_OCID="${TENANCY_OCID:-}"
[ -n "$TENANCY_OCID" ] || TENANCY_OCID="$(awk -F= '/^tenancy=/{print $2; exit}' /etc/oci/config)"
[ -n "$TENANCY_OCID" ] || die "could not determine tenancy OCID"

COMPARTMENT_OCID="$(oci iam compartment list   --compartment-id "$TENANCY_OCID"   --access-level ACCESSIBLE   --compartment-id-in-subtree true   --all --output json |
  jq -r '.data[] | select(.name=="Grasshopper" and ."lifecycle-state"=="ACTIVE") | .id' |
  head -1)"
[ -n "$COMPARTMENT_OCID" ] && [ "$COMPARTMENT_OCID" != "null" ] ||
  die "OCI compartment '$COMPARTMENT_NAME' not found"

find_instance() {
  oci compute instance list     --compartment-id "$COMPARTMENT_OCID"     --display-name "$INSTANCE_NAME"     --all --output json 2>/dev/null |
    jq -r '.data[] | select(."lifecycle-state" != "TERMINATED") | .id' |
    head -1
}

INSTANCE_OCID="$(find_instance || true)"

if [ -z "$INSTANCE_OCID" ] || [ "$INSTANCE_OCID" = "null" ]; then
  echo "No active $INSTANCE_NAME found."
  echo "Provisioning the isolated OCI workstation..."
  curl -fsSL "$REBUILD_URL" | bash
  [ -f "$ROOT/oci.env" ] || die "workstation rebuild completed without $ROOT/oci.env"
  # shellcheck disable=SC1090
  source "$ROOT/oci.env"
  INSTANCE_OCID="${INSTANCE_OCID:?missing INSTANCE_OCID from oci.env}"
  PUBLIC_IP="${PUBLIC_IP:?missing PUBLIC_IP from oci.env}"
else
  PUBLIC_IP="$(oci compute instance list-vnics     --instance-id "$INSTANCE_OCID"     --query 'data[0]."public-ip"' --raw-output 2>/dev/null || true)"
fi

[ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ] ||
  die "workstation has no public IPv4 address"

[ -f "$KEY" ] || {
  [ -f "$ROOT/oci.env" ] || die "SSH key and OCI state file are missing"
  # shellcheck disable=SC1090
  source "$ROOT/oci.env"
}
[ -f "$KEY" ] || die "OCI SSH key not found: $KEY"

echo "============================================================"
echo "GRASSHOPPER OCI BROWSER DESKTOP"
echo "============================================================"
echo "Instance: $INSTANCE_NAME"
echo "Public IP: $PUBLIC_IP"

ssh -o StrictHostKeyChecking=accept-new   -o ConnectTimeout=15   -o ServerAliveInterval=30   -o ServerAliveCountMax=6   -i "$KEY" "$SSH_USER@$PUBLIC_IP" 'bash -s' <<'REMOTE'
set -Eeuo pipefail

echo "=== HOST DESKTOP CONVERGENCE ==="

sudo dnf -y install epel-release dnf-utils
sudo dnf config-manager --set-enabled ol9_developer_EPEL || true
sudo dnf config-manager --set-enabled ol9_codeready_builder || true
sudo dnf clean metadata
sudo dnf -y makecache
sudo dnf -y install   tigervnc-server xorg-x11-server-Xorg dbus-x11 xterm   git curl wget openssl nginx
sudo dnf -y install   xfce4-session xfce4-panel xfdesktop xfwm4 xfconf   xfce4-settings thunar xfce4-terminal

if ! id grasshopper >/dev/null 2>&1; then
  sudo useradd -m -s /bin/bash grasshopper
fi
sudo usermod -aG wheel grasshopper
sudo install -d -m 700 -o grasshopper -g grasshopper /home/grasshopper/.vnc

if ! sudo test -f /home/grasshopper/.vnc/passwd; then
  VNC_PASSWORD="${GRASSHOPPER_VNC_PASSWORD:-}"
  if [ -z "$VNC_PASSWORD" ]; then
    VNC_PASSWORD="$(openssl rand -base64 12 | tr -dc 'A-Za-z0-9' | head -c 8)"
    echo "Generated VNC password: $VNC_PASSWORD"
    echo "Save it securely. VNC authentication uses at most 8 characters."
  fi
  printf '%s\n' "$VNC_PASSWORD" |
    sudo -u grasshopper vncpasswd -f |
    sudo tee /home/grasshopper/.vnc/passwd >/dev/null
  sudo chown grasshopper:grasshopper /home/grasshopper/.vnc/passwd
  sudo chmod 600 /home/grasshopper/.vnc/passwd
fi

sudo tee /usr/local/bin/grasshopper-vnc-session >/dev/null <<'SCRIPT'
#!/bin/bash
set -Eeuo pipefail

XVNC_PID=""
cleanup() {
  if [ -n "${XFCE_PID:-}" ]; then kill "$XFCE_PID" 2>/dev/null || true; fi
  if [ -n "$XVNC_PID" ]; then kill "$XVNC_PID" 2>/dev/null || true; fi
  wait "${XFCE_PID:-}" 2>/dev/null || true
  wait "${XVNC_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

/usr/bin/Xvnc :1   -geometry 1920x1080   -depth 24   -localhost   -SecurityTypes VncAuth   -rfbauth /home/grasshopper/.vnc/passwd   -AlwaysShared &
XVNC_PID=$!

for _ in $(seq 1 30); do
  ss -ltn | grep -q '127.0.0.1:5901' && break
  sleep 1
done

kill -0 "$XVNC_PID" 2>/dev/null ||
  { echo "ERROR: Xvnc exited before desktop startup"; exit 1; }

runuser -u grasshopper -- env   HOME=/home/grasshopper   USER=grasshopper   LOGNAME=grasshopper   DISPLAY=:1   XDG_CURRENT_DESKTOP=XFCE   XDG_SESSION_DESKTOP=xfce   dbus-run-session -- startxfce4   >/home/grasshopper/.vnc/xfce.log 2>&1 &
XFCE_PID=$!

wait "$XVNC_PID"
SCRIPT
sudo chmod 755 /usr/local/bin/grasshopper-vnc-session

sudo tee /etc/systemd/system/grasshopper-vnc.service >/dev/null <<'UNIT'
[Unit]
Description=Grasshopper persistent XFCE VNC desktop
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/grasshopper-vnc-session
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

sudo rm -rf /opt/noVNC
sudo git clone --depth 1 https://github.com/novnc/noVNC.git /opt/noVNC

sudo tee /etc/systemd/system/grasshopper-novnc.service >/dev/null <<'UNIT'
[Unit]
Description=Grasshopper noVNC browser gateway
After=grasshopper-vnc.service network.target
Requires=grasshopper-vnc.service

[Service]
Type=simple
User=root
ExecStart=/opt/noVNC/utils/novnc_proxy --listen 6080 --vnc localhost:5901
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

sudo tee /etc/nginx/nginx.conf >/dev/null <<'NGINX'
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
    server_name _;

    location / {
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
  }
}
NGINX

sudo rm -f /etc/nginx/conf.d/*.conf
sudo setsebool -P httpd_can_network_connect 1
sudo firewall-cmd --permanent --add-service=http >/dev/null
sudo firewall-cmd --reload >/dev/null

sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now grasshopper-vnc.service
sudo systemctl enable --now grasshopper-novnc.service
sudo systemctl enable --now nginx

sudo mkdir -p /home/grasshopper/src
if [ ! -d /home/grasshopper/src/Grasshopper/.git ]; then
  sudo -u grasshopper git clone https://github.com/onnxscibroccoli/Grasshopper.git     /home/grasshopper/src/Grasshopper
fi
sudo chown -R grasshopper:grasshopper /home/grasshopper/src

sleep 3

echo
echo "=== DESKTOP SELF-TEST ==="
systemctl is-active grasshopper-vnc.service
systemctl is-active grasshopper-novnc.service
systemctl is-active nginx

echo
echo "=== XFCE SELF-TEST ==="
pgrep -u grasshopper -x xfce4-session >/dev/null
pgrep -u grasshopper -x xfwm4 >/dev/null
pgrep -u grasshopper -x xfce4-panel >/dev/null
pgrep -u grasshopper -x xfdesktop >/dev/null
echo "XFCE_OK"

echo
echo "=== LOCAL HTTP SELF-TEST ==="
curl -fsS http://127.0.0.1:6080/vnc.html >/dev/null
curl -fsS http://127.0.0.1/vnc.html >/dev/null
echo "NOVNC_HTTP_OK"

echo
echo "=== LISTENER SELF-TEST ==="
ss -ltn | grep -q '127.0.0.1:5901'
ss -ltn | grep -q '0.0.0.0:6080'
ss -ltn | grep -q '0.0.0.0:80'
echo "LISTENERS_OK"

echo
echo "=== DESKTOP BOOTSTRAP: PASS ==="
REMOTE

# Converge OCI ingress for the public browser gateway.
VNIC_ID="$(oci compute instance list-vnics   --instance-id "$INSTANCE_OCID"   --query 'data[0]."vnic-id"' --raw-output)"
SUBNET_ID="$(oci compute vnic get --vnic-id "$VNIC_ID"   --query 'data."subnet-id"' --raw-output)"
SECURITY_LIST_ID="$(oci network subnet get --subnet-id "$SUBNET_ID"   --query 'data."security-list-ids[0]"' --raw-output)"

oci network security-list update   --security-list-id "$SECURITY_LIST_ID"   --ingress-security-rules '[
    {
      "description":"SSH",
      "isStateless":false,
      "protocol":"6",
      "source":"0.0.0.0/0",
      "sourceType":"CIDR_BLOCK",
      "tcpOptions":{"destinationPortRange":{"min":22,"max":22}}
    },
    {
      "description":"Grasshopper HTTP",
      "isStateless":false,
      "protocol":"6",
      "source":"0.0.0.0/0",
      "sourceType":"CIDR_BLOCK",
      "tcpOptions":{"destinationPortRange":{"min":80,"max":80}}
    }
  ]' --force >/dev/null

echo
echo "=== PUBLIC HTTP SELF-TEST ==="
curl -fsS --connect-timeout 10 --max-time 15   "http://$PUBLIC_IP/vnc.html" >/dev/null
echo "PUBLIC_NOVNC_HTTP_OK"

echo
echo "============================================================"
echo "GRASSHOPPER OCI REMOTE DESKTOP READY"
echo "============================================================"
echo "Browser: http://$PUBLIC_IP/vnc.html"
echo "VNC: localhost-only on 5901"
echo "noVNC: localhost:6080"
echo "nginx: public port 80"
echo "Services: persistent across reboot"
echo "OCI workstation: isolated from AWS production"
echo "============================================================"
