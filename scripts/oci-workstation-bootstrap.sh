#!/usr/bin/env bash
set -euo pipefail

# Grasshopper OCI workstation bootstrap
# Safe to rerun. No credentials are embedded or copied.
# AWS Helix/Kali is never touched.

export OCI_REGION="${OCI_REGION:-us-ashburn-1}"
REPO="https://github.com/onnxscibroccoli/Grasshopper.git"
NAME="Grasshopper-Workstation"
WORK="${HOME}/.grasshopper"
KEY="${WORK}/ssh/grasshopper_oci"
mkdir -p "${WORK}/ssh" "${HOME}/src"
chmod 700 "${WORK}/ssh"

if [ ! -f "${KEY}" ]; then
  ssh-keygen -t ed25519 -N "" -f "${KEY}" -C grasshopper-oci >/dev/null
fi

TENANCY_OCID="$(grep '^tenancy=' /etc/oci/config | head -1 | cut -d= -f2)"
COMPARTMENT_OCID="$(awk -F= '/^COMPARTMENT_OCID=/{print $2}' "${WORK}/oci.env" 2>/dev/null || true)"
VCN_OCID="$(awk -F= '/^VCN_OCID=/{print $2}' "${WORK}/oci.env" 2>/dev/null || true)"
SUBNET_OCID="$(awk -F= '/^SUBNET_OCID=/{print $2}' "${WORK}/oci.env" 2>/dev/null || true)"
AD="$(awk -F= '/^AVAILABILITY_DOMAIN=/{print $2}' "${WORK}/oci.env" 2>/dev/null || true)"

[ -n "${COMPARTMENT_OCID}" ] || { echo "Missing ~/.grasshopper/oci.env"; exit 1; }
[ -n "${SUBNET_OCID}" ] || { echo "Missing SUBNET_OCID"; exit 1; }
[ -n "${AD}" ] || { echo "Missing AVAILABILITY_DOMAIN"; exit 1; }

IMAGE_OCID="$(oci compute image list --compartment-id "${COMPARTMENT_OCID}" --operating-system 'Oracle Linux' --operating-system-version '9' --shape 'VM.Standard.A1.Flex' --all --query 'data[0].id' --raw-output)"

[ -n "${IMAGE_OCID}" ] && [ "${IMAGE_OCID}" != "null" ] || { echo "No VM.Standard.A1.Flex Oracle Linux 9 image available"; exit 1; }

INSTANCE_OCID="$(oci compute instance list --compartment-id "${COMPARTMENT_OCID}" --display-name "${NAME}" --all --query 'data[0].id' --raw-output 2>/dev/null || true)"

if [ -z "${INSTANCE_OCID}" ] || [ "${INSTANCE_OCID}" = "null" ]; then
  INSTANCE_OCID="$(oci compute instance launch \
    --compartment-id "${COMPARTMENT_OCID}" \
    --availability-domain "${AD}" \
    --shape VM.Standard.A1.Flex \
    --display-name "${NAME}" \
    --subnet-id "${SUBNET_OCID}" \
    --assign-public-ip true \
    --image-id "${IMAGE_OCID}" \
    --shape-config '{"ocpus":2,"memoryInGBs":12}' \
    --ssh-authorized-keys-file "${KEY}.pub" \
    --freeform-tags '{"Project":"Grasshopper","Environment":"experimental","ProtectedBase":"AWS-Helix-Kali","Role":"agent-workstation"}' \
    --query 'data.id' --raw-output)"
fi

echo "INSTANCE_OCID=${INSTANCE_OCID}"

oci compute instance get --instance-id "${INSTANCE_OCID}" --wait-for-state RUNNING --max-wait-seconds 600 >/dev/null

VNIC_ID="$(oci compute instance list-vnics --instance-id "${INSTANCE_OCID}" --query 'data[0].id' --raw-output)"
PUBLIC_IP="$(oci network vnic get --vnic-id "${VNIC_ID}" --query 'data."public-ip"' --raw-output)"

cat > "${WORK}/oci.env" <<EOF
TENANCY_OCID=${TENANCY_OCID}
COMPARTMENT_OCID=${COMPARTMENT_OCID}
REGION=${OCI_REGION}
AVAILABILITY_DOMAIN=${AD}
VCN_OCID=${VCN_OCID}
SUBNET_OCID=${SUBNET_OCID}
INSTANCE_OCID=${INSTANCE_OCID}
VNIC_OCID=${VNIC_ID}
PUBLIC_IP=${PUBLIC_IP}
SSH_KEY=${KEY}
EOF
chmod 600 "${WORK}/oci.env"

echo "Waiting for SSH..."
for i in $(seq 1 36); do
  if ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -i "${KEY}" "opc@${PUBLIC_IP}" true 2>/dev/null; then break; fi
  [ "$i" -eq 36 ] && { echo "SSH did not become ready"; exit 1; }
  sleep 10
done

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i "${KEY}" "opc@${PUBLIC_IP}" 'bash -s' <<'REMOTE'
set -euo pipefail
sudo dnf -y install git git-lfs curl wget jq unzip tar gzip tmux vim rsync ca-certificates openssh-clients python3 python3-pip gcc gcc-c++ make
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -
  sudo dnf -y install nodejs
fi
mkdir -p "$HOME/src"
if [ -d "$HOME/src/Grasshopper/.git" ]; then
  cd "$HOME/src/Grasshopper"
  git remote set-url origin https://github.com/onnxscibroccoli/Grasshopper.git
  git fetch origin
  git checkout main
  git reset --hard origin/main
else
  git clone https://github.com/onnxscibroccoli/Grasshopper.git "$HOME/src/Grasshopper"
  cd "$HOME/src/Grasshopper"
fi
npm install
npm test
echo "GRASSHOPPER_WORKSTATION_READY"
REMOTE

echo
echo "GRASSHOPPER WORKSTATION READY"
echo "PUBLIC_IP=${PUBLIC_IP}"
echo "SSH_KEY=${KEY}"
echo "ssh -i ${KEY} opc@${PUBLIC_IP}"
