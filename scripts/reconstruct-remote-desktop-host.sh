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
  virt-customize -a "$staged" \
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

if [[ -f "$HELIX_ROOT/production/gateway/helix-gateway.nginx.conf" ]]; then
  install -m 0644 "$HELIX_ROOT/production/gateway/helix-gateway.nginx.conf" /etc/nginx/sites-available/helix-gateway
  ln -sfn /etc/nginx/sites-available/helix-gateway /etc/nginx/sites-enabled/helix-gateway
  rm -f /etc/nginx/sites-enabled/default
fi

systemctl daemon-reload
systemctl enable libvirtd.service helix-libvirt-hypervisor.service
nginx -t
systemctl enable nginx.service

echo "Helix L1 desktop host reconstructed"
echo "helix_commit=$HELIX_COMMIT"
echo "kali_base=$KALI_BASE_IMAGE"
echo "kali_base_sha256=$(sha256sum "$KALI_BASE_IMAGE" | awk '{print $1}')"
echo "kvm=$(test -e /dev/kvm && echo PRESENT || echo ABSENT)"
