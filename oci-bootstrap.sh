#!/usr/bin/env bash
set -Eeuo pipefail

# Grasshopper OCI browser desktop bootstrap.
# Convergent entrypoint: creates the experimental OCI workstation if it is absent,
# then configures a persistent XFCE + VNC + noVNC browser desktop.
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

COMPARTMENT_OCID="$(oci iam compartment list   --compartment-id "$TENANCY_OCID"   --access-level ACCESSIBLE   --compartment-id-in-subtree true   --all   --output json |
  jq -r '.data[] | select(.name=="Grasshopper" and ."lifecycle-state"=="ACTIVE") | .id' | head -1)"
[ -n "$COMPARTMENT_OCID" ] && [ "$COMPARTMENT_OCID" != "null" ] ||
  die "OCI compartment '$COMPARTMENT_NAME' not found"

find_instance() {
  oci compute instance list     --compartment-id "$COMPARTMENT_OCID"     --display-name "$INSTANCE_NAME"     --all     --output json 2>/dev/null |
    jq -r '.data[] | select(."lifecycle-state" != "TERMINATED") | .id' | head -1
}

INSTANCE_OCID="$(find_instance || true)"

if [ -z "$INSTANCE_OCID" ] || [ "$INSTANCE_OCID" = "null" ]; then
  echo "No active $INSTANCE_NAME found."
  echo "Provisioning the experimental OCI workstation now..."
  echo

  curl -fsSL "$REBUILD_URL" | bash

  [ -f "$ROOT/oci.env" ] || die "workstation rebuild completed without $ROOT/oci.env"
  # shellcheck disable=SC1090
  source "$ROOT/oci.env"

  INSTANCE_OCID="$INSTANCE_OCID"
  PUBLIC_IP="$PUBLIC_IP"
else
  PUBLIC_IP="$(oci compute instance list-vnics     --instance-id "$INSTANCE_OCID"     --query 'data[0]."public-ip"'     --raw-output 2>/dev/null || true)"
fi

[ -n "$INSTANCE_OCID" ] && [ "$INSTANCE_OCID" != "null" ] || die "unable to determine workstation OCID"
[ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ] || die "workstation has no public IPv4 address"

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
echo

ssh -o StrictHostKeyChecking=accept-new     -o ConnectTimeout=15     -o ServerAliveInterval=30     -o ServerAliveCountMax=6     -i "$KEY"     "$SSH_USER@$PUBLIC_IP" 'bash -s' <<'REMOTE'
set -Eeuo pipefail

echo "Installing graphical desktop and browser gateway..."

sudo dnf -y install epel-release dnf-utils
sudo dnf config-manager --set-enabled ol9_developer_EPEL || true
sudo dnf config-manager --set-enabled ol9_codeready_builder || true
sudo dnf clean metadata
sudo dnf -y makecache
sudo dnf -y install   tigervnc-server   xorg-x11-server-Xorg   dbus-x11   xterm   git   curl   wget   openssl   nginx

sudo dnf -y install xfce4-session xfce4-panel xfdesktop xfwm4 xfconf xfce4-settings thunar xfce4-terminal

if ! id grasshopper >/dev/null 2>&1; then
  sudo useradd -m -s /bin/bash grasshopper
fi
sudo usermod -aG wheel grasshopper

sudo install -d -m 700 -o grasshopper -g grasshopper /home/grasshopper/.vnc

if [ ! -f /home/grasshopper/.vnc/passwd ]; then
  echo
  echo "============================================================"
  echo "CREATE YOUR REMOTE DESKTOP PASSWORD"
  echo "============================================================"
  sudo -u grasshopper vncpasswd
fi

sudo -u grasshopper tee /home/grasshopper/.vnc/xstartup >/dev/null <<'EOF'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XDG_CURRENT_DESKTOP=XFCE
export XDG_SESSION_DESKTOP=xfce
exec dbus-launch --exit-with-session startxfce4
EOF
sudo chmod 700 /home/grasshopper/.vnc/xstartup
sudo chown grasshopper:grasshopper /home/grasshopper/.vnc/xstartup

sudo rm -rf /opt/noVNC
sudo git clone --depth 1 https://github.com/novnc/noVNC.git /opt/noVNC
sudo ln -sf /opt/noVNC/utils/novnc_proxy /usr/local/bin/novnc_proxy

sudo tee /etc/systemd/system/grasshopper-vnc.service >/dev/null <<'EOF'
[Unit]
Description=Grasshopper persistent VNC desktop
After=network.target

[Service]
Type=forking
User=grasshopper
Group=grasshopper
WorkingDirectory=/home/grasshopper
PIDFile=/home/grasshopper/.vnc/%H:1.pid
ExecStartPre=/bin/sh -c '/usr/bin/vncserver -kill :1 >/dev/null 2>&1 || true'
ExecStart=/usr/bin/vncserver :1 -geometry 1920x1080 -depth 24 -localhost yes -SecurityTypes VncAuth
ExecStop=/usr/bin/vncserver -kill :1
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/grasshopper-novnc.service >/dev/null <<'EOF'
[Unit]
Description=Grasshopper browser desktop noVNC
After=grasshopper-vnc.service
Requires=grasshopper-vnc.service

[Service]
Type=simple
ExecStart=/opt/noVNC/utils/novnc_proxy --listen 6080 --vnc localhost:5901
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/nginx/conf.d/grasshopper-desktop.conf >/dev/null <<'EOF'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:6080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF

sudo rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
sudo nginx -t

sudo systemctl daemon-reload
sudo systemctl enable --now grasshopper-vnc.service
sudo systemctl enable --now grasshopper-novnc.service
sudo systemctl enable --now nginx

sudo mkdir -p /home/grasshopper/src
if [ ! -d /home/grasshopper/src/Grasshopper/.git ]; then
  sudo -u grasshopper git clone https://github.com/onnxscibroccoli/Grasshopper.git /home/grasshopper/src/Grasshopper
fi
sudo chown -R grasshopper:grasshopper /home/grasshopper/src

echo
echo "=== SERVICE ACCEPTANCE ==="
systemctl is-active grasshopper-vnc.service
systemctl is-active grasshopper-novnc.service
systemctl is-active nginx

echo
echo "=== LOCAL LISTENERS ==="
sudo ss -lnt | grep -E ':(80|5901|6080)\b' || true

echo
echo "=== BROWSER GATEWAY ==="
curl -fsS http://127.0.0.1:6080/ >/dev/null
echo "NOVNC_HTTP_OK"
REMOTE

echo
echo "============================================================"
echo "GRASSHOPPER REMOTE DESKTOP READY"
echo "============================================================"
echo
echo "Open in any browser:"
echo
echo "  http://$PUBLIC_IP/"
echo
echo "VNC: localhost-only on 5901"
echo "noVNC: localhost:6080"
echo "nginx: public browser gateway on port 80"
echo
echo "The desktop services are enabled for reboot persistence."
echo "The OCI workstation is experimental and isolated from AWS production."
echo "============================================================"
