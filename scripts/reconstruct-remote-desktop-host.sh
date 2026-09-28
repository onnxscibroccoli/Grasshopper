#!/usr/bin/env bash
set -euo pipefail

# Reconstruct the L1 Helix desktop host from source.
# Secrets are passed as references only. No credential payload belongs in this file.

: "${HELIX_REPO:=https://github.com/onnxscibroccoli/helix.git}"
: "${HELIX_COMMIT:?HELIX_COMMIT is required}"
: "${AWS_REGION:=us-east-1}"
: "${KALI_QEMU_DATE:=2026-09-24}"
: "${KALI_BASE_DIR:=/var/lib/helix/disks}"
: "${KALI_BASE_IMAGE:=${KALI_BASE_DIR}/kali-rolling-base.qcow2}"
: "${HELIX_ROOT:=/opt/helix}"

export DEBIAN_FRONTEND=noninteractive

if [[ -n "${STACK_NAME:-}" ]]; then
  for attempt in $(seq 1 60); do
    stack_outputs="$(aws cloudformation describe-stacks --region "$AWS_REGION" --stack-name "$STACK_NAME" --query 'Stacks[0].Outputs' --output json 2>/dev/null || true)"
    if [[ -n "$stack_outputs" && "$stack_outputs" != "null" ]]; then
      COGNITO_CLIENT_ID="$(printf '%s' "$stack_outputs" | python3 -c 'import json,sys; o={x["OutputKey"]:x["OutputValue"] for x in json.load(sys.stdin)}; print(o.get("UserPoolClientId",""))')"
      PUBLIC_ORIGIN="$(printf '%s' "$stack_outputs" | python3 -c 'import json,sys; o={x["OutputKey"]:x["OutputValue"] for x in json.load(sys.stdin)}; print(o.get("DashboardURL",""))')"
      if [[ -n "$COGNITO_CLIENT_ID" && -n "$PUBLIC_ORIGIN" ]]; then
        export COGNITO_CLIENT_ID PUBLIC_ORIGIN
        break
      fi
    fi
    sleep 10
  done
fi

: "${COGNITO_CLIENT_ID:?COGNITO_CLIENT_ID could not be resolved}"
: "${PUBLIC_ORIGIN:?PUBLIC_ORIGIN could not be resolved}"

apt-get update
apt-get install -y \
  qemu-system-x86 qemu-utils libvirt-daemon-system libvirt-clients virtinst \
  bridge-utils ovmf cpu-checker nginx git curl ca-certificates nodejs npm \
  python3 python3-venv awscli p7zip-full libguestfs-tools guestfs-tools \
  gnupg2 x11vnc novnc websockify

if ! snap list amazon-ssm-agent >/dev/null 2>&1; then
  apt-get install -y snapd
  snap install amazon-ssm-agent --classic
fi
systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service

modprobe kvm_intel nested=1 2>/dev/null || modprobe kvm_amd nested=1
test -e /dev/kvm
systemctl enable --now libvirtd.service
virsh -c qemu:///system net-start default 2>/dev/null || true
virsh -c qemu:///system net-autostart default

install -d -m 0755 "$HELIX_ROOT" "$KALI_BASE_DIR"

if [[ ! -d "$HELIX_ROOT/.git" ]]; then
  git clone "$HELIX_REPO" "$HELIX_ROOT"
fi
git -C "$HELIX_ROOT" fetch --prune origin
git -C "$HELIX_ROOT" reset --hard "$HELIX_COMMIT"
git -C "$HELIX_ROOT" clean -fdx

# Apply the captured production overlay from the verified Helix pin.
OVERLAY_ROOT="/opt/grasshopper/vendor/helix-production-overlay"
git -C "$HELIX_ROOT" apply --whitespace=nowarn "$OVERLAY_ROOT/omnikali-production-overlay.patch"
install -d -m 0755 "$HELIX_ROOT/production/agent" "$HELIX_ROOT/production/gateway/state"
install -m 0644 "$OVERLAY_ROOT/production/gateway/portal.html" "$HELIX_ROOT/production/gateway/portal.html"
install -m 0644 "$OVERLAY_ROOT/production/gateway/acceptance.html" "$HELIX_ROOT/production/gateway/acceptance.html"
install -m 0644 "$OVERLAY_ROOT/production/gateway/omni-mcp.mjs" "$HELIX_ROOT/production/gateway/omni-mcp.mjs"
install -m 0644 "$OVERLAY_ROOT/production/gateway/omni-mcp-oauth.mjs" "$HELIX_ROOT/production/gateway/omni-mcp-oauth.mjs"
install -m 0644 "$OVERLAY_ROOT/production/gateway/omnikali-handoff.mjs" "$HELIX_ROOT/production/gateway/omnikali-handoff.mjs"
install -m 0644 "$OVERLAY_ROOT/production/gateway/state/agent-secret.mjs" "$HELIX_ROOT/production/gateway/state/agent-secret.mjs"
install -m 0644 "$OVERLAY_ROOT/production/agent/agent-secret.mjs" "$HELIX_ROOT/production/agent/agent-secret.mjs"
install -m 0644 "$OVERLAY_ROOT/production/agent/omni-agent.mjs" "$HELIX_ROOT/production/agent/omni-agent.mjs"
install -m 0644 "$OVERLAY_ROOT/production/agent/openapi.yaml" "$HELIX_ROOT/production/agent/openapi.yaml"
install -m 0644 "$OVERLAY_ROOT/production/OMNIKALI_GUI_ARBITRATION.md" "$HELIX_ROOT/production/OMNIKALI_GUI_ARBITRATION.md"

build_kali_base() {
  local work="/var/tmp/helix-kali-base-$KALI_QEMU_DATE"
  local archive="kali-linux-$KALI_QEMU_DATE-qemu-amd64.7z"
  local sums="kali-linux-$KALI_QEMU_DATE.SHA256SUMS"
  local sig="kali-linux-$KALI_QEMU_DATE.SHA256SUMS.sig"
  local base="https://image-amd64.kali.org/vm/kali-daily"

  rm -rf "$work"
  mkdir -p "$work"
  cd "$work"

  curl -fsSLO "$base/$sums"
  curl -fsSLO "$base/$sig"
  curl -fsSLO "$base/$archive"

  curl -fsSL https://archive.kali.org/archive-key.asc | gpg --batch --import
  expected_key="827C8569F2518CC677FECA1AED65462EC8D5E4C5"
  fingerprint="$(gpg --batch --with-colons --fingerprint 827C8569F2518CC677FECA1AED65462EC8D5E4C5 | awk -F: '$1=="fpr" {print $10; exit}')"
  [[ "$fingerprint" == "$expected_key" ]] || { echo "Kali signing-key fingerprint mismatch" >&2; exit 1; }

  gpg --batch --verify "$sig" "$sums"
  grep " $archive$" "$sums" | sha256sum -c -

  7z x -y "$archive" -o"$work/extracted" >/dev/null
  source_image="$(find "$work/extracted" -type f \( -name '*.qcow2' -o -name '*.img' \) -print -quit)"
  [[ -n "$source_image" ]] || { echo "Kali QEMU archive did not contain a qcow2/img disk" >&2; exit 1; }

  local staged="$KALI_BASE_IMAGE.tmp"
  rm -f "$staged"
  qemu-img convert -p -O qcow2 "$source_image" "$staged"
  qemu-img resize "$staged" 16G
  virt-customize -a "$staged" --network \
    --install kali-desktop-xfce,firefox-esr,qemu-guest-agent,dbus-x11,x11vnc \
    --run-command 'update-alternatives --set x-session-manager /usr/bin/startxfce4 || true' \
    --mkdir /etc/lightdm/lightdm.conf.d \
    --upload /tmp/helix-lightdm.conf:/etc/lightdm/lightdm.conf.d/50-helix-autologin.conf \
    --run-command 'systemctl enable qemu-guest-agent || true' \
    --run-command 'systemctl enable lightdm || true'
  mv "$staged" "$KALI_BASE_IMAGE"
  chmod 0640 "$KALI_BASE_IMAGE"
  chown libvirt-qemu:libvirt-qemu "$KALI_BASE_IMAGE" || true
  rm -rf "$work"
}

cat >/tmp/helix-lightdm.conf <<'EOF'
[Seat:*]
autologin-user=kali
autologin-user-timeout=0
user-session=xfce
EOF

if [[ ! -s "$KALI_BASE_IMAGE" ]]; then
  build_kali_base
fi

install -d -m 0755 /etc/helix /var/lib/helix /etc/systemd/system/helix-libvirt-hypervisor.service.d
cat >/etc/systemd/system/helix-libvirt-hypervisor.service.d/kali-rolling.conf <<'EOF'
[Service]
Environment="HELIX_BASE_IMAGE=/var/lib/helix/disks/kali-rolling-base.qcow2"
Environment="HELIX_VM_MEMORY_MB=2048"
Environment="HELIX_VM_VCPUS=2"
Environment="HELIX_PERSISTENT_DISK_GB=40"
EOF

# Install the validated production service definitions when present.
for unit in \
  helix-libvirt-hypervisor.service \
  helix-gateway.service \
  helix-ebs-volume-agent.service \
  helix-vnc.service \
  helix-novnc.service \
  helix-desktop.service \
  helix-xfce.service; do
  if [[ -f "$HELIX_ROOT/production/desktop/$unit" ]]; then
    install -m 0644 "$HELIX_ROOT/production/desktop/$unit" "/etc/systemd/system/$unit"
  elif [[ -f "$HELIX_ROOT/production/gateway/$unit" ]]; then
    install -m 0644 "$HELIX_ROOT/production/gateway/$unit" "/etc/systemd/system/$unit"
  fi
done

cat >/usr/local/sbin/helix-gateway-launcher <<'EOF'
#!/bin/sh
set -eu
set -a
. /etc/helix/gateway.env
set +a
secret_json=$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$DB_SECRET_ARN" --query SecretString --output text)
export DATABASE_URL=$(printf '%s' "$secret_json" | python3 -c 'import json,sys; from urllib.parse import quote; s=json.load(sys.stdin); print("postgresql://"+quote(s["username"],safe="")+":"+quote(s["password"],safe="")+"@"+s["host"]+":"+str(s["port"])+"/"+s["dbname"]+"?sslmode=require&uselibpqcompat=true")')
unset secret_json
export OIDC_CLIENT_SECRET=$(aws cognito-idp describe-user-pool-client --region "$AWS_REGION" --user-pool-id "$COGNITO_USER_POOL_ID" --client-id "$OIDC_CLIENT_ID" --query UserPoolClient.ClientSecret --output text)
export SESSION_SIGNING_SECRET=$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$SESSION_SECRET_ARN" --query SecretString --output text)
exec /usr/bin/node /opt/helix/production/gateway/helix-gateway.mjs
EOF
chmod 0750 /usr/local/sbin/helix-gateway-launcher

cat >/usr/local/sbin/helix-ebs-volume-agent-launcher <<'EOF'
#!/bin/sh
set -eu
token=$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$STORAGE_TOKEN_SECRET_ID" --query SecretString --output text)
export HELIX_STORAGE_AGENT_TOKEN="$token"
unset token
exec /opt/helix/.venv/bin/python /opt/helix/production/storage/helix-ebs-volume-agent.py
EOF
chmod 0750 /usr/local/sbin/helix-ebs-volume-agent-launcher

cat >/etc/systemd/system/helix-ebs-volume-agent.service <<'EOF'
[Unit]
Description=Helix encrypted per-workspace EBS volume agent
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
WorkingDirectory=/opt/helix
Environment=AWS_REGION=$AWS_REGION
Environment=HELIX_MOUNT_ROOT=/var/lib/helix/ebs
Environment=HELIX_DEFAULT_VOLUME_GB=40
Environment=HELIX_MAX_VOLUME_GB=1000
EnvironmentFile=/etc/helix/ebs-agent.env
ExecStart=/usr/local/sbin/helix-ebs-volume-agent-launcher
Restart=always
RestartSec=3
PrivateTmp=true
ReadWritePaths=/var/lib/helix
[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/helix-desktop.service <<'EOF'
[Unit]
Description=Helix XFCE virtual desktop
After=network.target
Wants=network.target
[Service]
Type=simple
User=root
Environment=DISPLAY=:99
Environment=HOME=/root
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac
Restart=always
RestartSec=2
[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/helix-xfce.service <<'EOF'
[Unit]
Description=Helix XFCE session
After=helix-desktop.service
Requires=helix-desktop.service
[Service]
Type=simple
User=root
Environment=DISPLAY=:99
Environment=HOME=/root
ExecStart=/bin/bash -lc 'dbus-run-session -- xfce4-session'
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/helix-vnc.service <<'EOF'
[Unit]
Description=Helix VNC bridge
After=helix-xfce.service
Requires=helix-xfce.service
[Service]
Type=simple
User=root
Environment=DISPLAY=:99
ExecStart=/usr/bin/x11vnc -display :99 -rfbport 5900 -localhost -forever -shared -nopw -noxrecord -noxfixes -noxdamage
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/helix-novnc.service <<'EOF'
[Unit]
Description=Helix noVNC websocket gateway
After=helix-vnc.service
Requires=helix-vnc.service
[Service]
Type=simple
User=root
ExecStart=/usr/bin/websockify --web=/usr/share/novnc 127.0.0.1:6080 127.0.0.1:5900
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
EOF

IMDS_TOKEN=$(curl -fsS -X PUT -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600' http://169.254.169.254/latest/api/token)
HELIX_INSTANCE_ID=$(curl -fsS -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/instance-id)
HELIX_AVAILABILITY_ZONE=$(curl -fsS -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/meta-data/placement/availability-zone)
cat >/etc/helix/ebs-agent.env <<EOF
AWS_REGION=$AWS_REGION
HELIX_INSTANCE_ID=$HELIX_INSTANCE_ID
HELIX_AVAILABILITY_ZONE=$HELIX_AVAILABILITY_ZONE
STORAGE_TOKEN_SECRET_ID=$STORAGE_TOKEN_SECRET_ID
EOF

cat >/etc/helix/gateway.env <<EOF
AWS_REGION=$AWS_REGION
GATEWAY_HOST=127.0.0.1
GATEWAY_PORT=8092
OIDC_ISSUER_URL=https://cognito-idp.$AWS_REGION.amazonaws.com/$COGNITO_USER_POOL_ID
OIDC_CLIENT_ID=$COGNITO_CLIENT_ID
OIDC_REDIRECT_URI=$PUBLIC_ORIGIN/auth/callback
HELIX_PUBLIC_ORIGIN=$PUBLIC_ORIGIN
HELIX_HYPERVISOR_URL=http://127.0.0.1:8090
SESSION_TTL_SECONDS=3600
WS_TICKET_TTL_SECONDS=60
DB_SECRET_ARN=$DB_SECRET_ARN
SESSION_SECRET_ARN=$SESSION_SECRET_ARN
STORAGE_TOKEN_SECRET_ID=$STORAGE_TOKEN_SECRET_ID
AGENT_TOKEN_SECRET_ID=$AGENT_TOKEN_SECRET_ID
COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
EOF
cat >/etc/helix/agent.env <<EOF
AWS_REGION=$AWS_REGION
AGENT_HOST=127.0.0.1
AGENT_PORT=8093
AGENT_VM=helix-omnikali
HELIX_AGENT_TOKEN_SECRET_ID=$AGENT_TOKEN_SECRET_ID
EOF

cat >/etc/helix/mcp.env <<EOF
AWS_REGION=$AWS_REGION
MCP_HOST=127.0.0.1
MCP_PORT=8094
MCP_VM=helix-omnikali
MCP_STATE_DIR=/var/lib/omnikali/mcp
HELIX_PUBLIC_ORIGIN=$PUBLIC_ORIGIN
OIDC_CLIENT_ID=$COGNITO_CLIENT_ID
OIDC_MANAGED_DOMAIN=https://$COGNITO_DOMAIN_PREFIX.auth.$AWS_REGION.amazoncognito.com
EOF

cat >/usr/local/sbin/omni-mcp-launcher <<'EOF'
#!/bin/sh
set -eu
set -a
. /etc/helix/agent.env
. /etc/helix/mcp.env
set +a
export MCP_AUTH_TOKEN="$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$HELIX_AGENT_TOKEN_SECRET_ID" --query SecretString --output text)"
export OIDC_CLIENT_SECRET="$(aws cognito-idp describe-user-pool-client --region "$AWS_REGION" --user-pool-id "$COGNITO_USER_POOL_ID" --client-id "$OIDC_CLIENT_ID" --query UserPoolClient.ClientSecret --output text)"
exec /usr/bin/node /opt/helix/production/gateway/omni-mcp.mjs
EOF
chmod 0750 /usr/local/sbin/omni-mcp-launcher

cat >/etc/systemd/system/omni-agent.service <<'EOF'
[Unit]
Description=OmniKali authenticated remote agent bridge
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
WorkingDirectory=/opt/helix/production/agent
EnvironmentFile=/etc/helix/agent.env
ExecStart=/usr/bin/node /opt/helix/production/agent/omni-agent.mjs
Restart=always
RestartSec=2
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/opt/helix/production/agent
[Install]
WantedBy=multi-user.target
EOF

cat >/etc/systemd/system/omni-mcp.service <<'EOF'
[Unit]
Description=OmniKali Model Context Protocol control plane
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
WorkingDirectory=/opt/helix/production/gateway
EnvironmentFile=/etc/helix/agent.env
EnvironmentFile=/etc/helix/mcp.env
Environment=COGNITO_USER_POOL_ID=$COGNITO_USER_POOL_ID
ExecStart=/usr/local/sbin/omni-mcp-launcher
Restart=always
RestartSec=2
[Install]
WantedBy=multi-user.target
EOF

chmod 0600 /etc/helix/gateway.env /etc/helix/ebs-agent.env /etc/helix/agent.env /etc/helix/mcp.env

sed -i 's#ExecStart=/bin/sh /opt/helix/production/gateway/start-helix-gateway.sh#ExecStart=/usr/local/sbin/helix-gateway-launcher#' /etc/systemd/system/helix-gateway.service 2>/dev/null || true

cd "$HELIX_ROOT"
npm ci --omit=dev

if [[ -f "$HELIX_ROOT/production/gateway/package-lock.json" ]]; then
  cd "$HELIX_ROOT/production/gateway"
  npm ci --omit=dev
fi

python3 -m venv "$HELIX_ROOT/.venv"
"$HELIX_ROOT/.venv/bin/pip" install --disable-pip-version-check -r "$HELIX_ROOT/production/storage/requirements.txt"

DB_JSON=$(aws secretsmanager get-secret-value --region "$AWS_REGION" --secret-id "$DB_SECRET_ARN" --query SecretString --output text)
export DATABASE_URL=$(printf '%s' "$DB_JSON" | python3 -c 'import json,sys; from urllib.parse import quote; s=json.load(sys.stdin); print("postgresql://"+quote(s["username"],safe="")+":"+quote(s["password"],safe="")+"@"+s["host"]+":"+str(s["port"])+"/"+s["dbname"]+"?sslmode=require")')
cd "$HELIX_ROOT"
migration_ok=false
for attempt in $(seq 1 60); do
  if npm run db:migrate; then
    migration_ok=true
    break
  fi
  echo "database migration attempt $attempt/60 failed; waiting for PostgreSQL readiness" >&2
  sleep 10
done
unset DATABASE_URL DB_JSON
if [[ "$migration_ok" != true ]]; then
  echo "database migration did not succeed within the bounded readiness window" >&2
  exit 1
fi

if [[ -f "$HELIX_ROOT/production/gateway/helix-gateway.nginx.conf" ]]; then
  install -m 0644 "$HELIX_ROOT/production/gateway/helix-gateway.nginx.conf" /etc/nginx/sites-available/helix-gateway
  ln -sfn /etc/nginx/sites-available/helix-gateway /etc/nginx/sites-enabled/helix-gateway
  rm -f /etc/nginx/sites-enabled/default
fi

systemctl daemon-reload
systemctl enable libvirtd.service helix-libvirt-hypervisor.service
nginx -t
systemctl enable nginx.service helix-ebs-volume-agent.service helix-desktop.service helix-xfce.service helix-vnc.service helix-novnc.service helix-gateway.service omni-agent.service omni-mcp.service

echo "Helix L1 desktop host reconstructed"
echo "helix_commit=$HELIX_COMMIT"
echo "kali_base=$KALI_BASE_IMAGE"
echo "kali_base_sha256=$(sha256sum "$KALI_BASE_IMAGE" | awk '{print $1}')"
echo "kvm=$(test -e /dev/kvm && echo PRESENT || echo ABSENT)"
