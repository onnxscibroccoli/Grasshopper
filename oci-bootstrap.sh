#!/usr/bin/env bash
set -Eeuo pipefail

# Grasshopper OCI browser desktop bootstrap.
# Safe to rerun. Reuses the existing Grasshopper-Workstation when present.
# It configures a persistent XFCE desktop, VNC on localhost:5901, and noVNC
# through nginx on TCP/80. It does not touch the protected AWS environment.

REGION="${OCI_CLI_REGION:-us-ashburn-1}"
COMPARTMENT_NAME="Grasshopper"
INSTANCE_NAME="Grasshopper-Workstation"
SSH_USER="opc"
KEY="${GRASSHOPPER_OCI_SSH_KEY:-$HOME/.grasshopper/ssh/grasshopper_oci}"

die() { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

need oci
need ssh
[ -f "$KEY" ] || die "OCI SSH key not found: $KEY"

export OCI_CLI_REGION="$REGION"

TENANCY_OCID="${TENANCY_OCID:-}"
if [ -z "$TENANCY_OCID" ] && [ -r /etc/oci/config ]; then
  TENANCY_OCID="$(awk -F= '/^tenancy=/{print $2; exit}' /etc/oci/config)"
fi
[ -n "$TENANCY_OCID" ] || die "could not determine tenancy OCID"

COMPARTMENT_OCID="$(oci iam compartment list   --compartment-id "$TENANCY_OCID"   --access-level ACCESSIBLE   --compartment-id-in-subtree true   --all   --query "data[?name=='$COMPARTMENT_NAME'].id | [0]"   --raw-output 2>/dev/null || true)"

[ -n "$COMPARTMENT_OCID" ] && [ "$COMPARTMENT_OCID" != "null" ] ||
  die "OCI compartment '$COMPARTMENT_NAME' not found"

INSTANCE_OCID="$(oci compute instance list   --compartment-id "$COMPARTMENT_OCID"   --display-name "$INSTANCE_NAME"   --all   --query "data[?lifecycle-state!='TERMINATED'] | [0].id"   --raw-output 2>/dev/null || true)"

[ -n "$INSTANCE_OCID" ] && [ "$INSTANCE_OCID" != "null" ] ||
  die "no active $INSTANCE_NAME found; run the existing OCI workstation rebuild first"

PUBLIC_IP="$(oci compute instance list-vnics   --instance-id "$INSTANCE_OCID"   --query 'data[0]."public-ip"'   --raw-output 2>/dev/null || true)"

[ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ] ||
  die "workstation has no public IPv4 address"

echo "Grasshopper OCI workstation: $INSTANCE_NAME"
echo "Public IP: $PUBLIC_IP"
echo

echo "Configuring persistent graphical desktop..."
echo "You will be prompted once for the VNC password."
echo

ssh -o StrictHostKeyChecking=accept-new     -o ConnectTimeout=15     -o ServerAliveInterval=30     -o ServerAliveCountMax=6     -i "$KEY"     "$SSH_USER@$PUBLIC_IP" 'bash -s' <<'REMOTE'
set -Eeuo pipefail

sudo dnf -y install epel-release
sudo dnf -y install   tigervnc-server   xorg-x11-server-Xorg   dbus-x11   xterm   git   curl   wget   openssl   nginx

sudo dnf -y groupinstall "Xfce"

if ! id grasshopper >/dev/null 2>&1; then
  sudo useradd -m -s /bin/bash grasshopper
fi
sudo usermod -aG wheel grasshopper

sudo install -d -m 700 -o grasshopper -g grasshopper /home/grasshopper/.vnc

if [ ! -f /home/grasshopper/.vnc/passwd ]; then
  echo
  echo "Create the browser desktop VNC password:"
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

if [ ! -d /home/grasshopper/src/Grasshopper/.git ]; then
  sudo -u grasshopper mkdir -p /home/grasshopper/src
  sudo -u grasshopper git clone https://github.com/onnxscibroccoli/Grasshopper.git /home/grasshopper/src/Grasshopper
fi

sudo chown -R grasshopper:grasshopper /home/grasshopper/src

echo
echo "=== DESKTOP SERVICES ==="
systemctl is-active grasshopper-vnc.service
systemctl is-active grasshopper-novnc.service
systemctl is-active nginx

echo
echo "=== LOCAL LISTENERS ==="
sudo ss -lnt | grep -E ':(80|5901|6080)\b' || true
REMOTE

echo
echo "============================================================"
echo "GRASSHOPPER REMOTE DESKTOP READY"
echo "============================================================"
echo
echo "Open this in any browser:"
echo
echo "  http://$PUBLIC_IP/"
echo
echo "The VNC server is localhost-only. noVNC is the browser gateway."
echo "The desktop services are enabled for reboot persistence."
echo
echo "If the browser cannot connect, TCP/80 must be permitted by the"
echo "OCI subnet/security-list or NSG attached to the workstation VNIC."
echo
echo "The command is safe to rerun and will reuse the existing workstation."
