#!/usr/bin/env bash
set -Eeuo pipefail

# Grasshopper OCI workstation: destructive rebuild of the experimental workstation only.
# This never touches AWS/Helix/Kali or any resource outside the Grasshopper compartment.
export OCI_REGION="${OCI_REGION:-us-ashburn-1}"
NAME="Grasshopper-Workstation"
ROOT="${HOME}/.grasshopper"
SSH_DIR="${ROOT}/ssh"
KEY="${SSH_DIR}/grasshopper_oci"
ENV_FILE="${ROOT}/oci.env"
ARCHIVE="${SSH_DIR}/archive-$(date +%Y%m%d%H%M%S)"
mkdir -p "${SSH_DIR}" "${ARCHIVE}"
chmod 700 "${SSH_DIR}"

command -v oci >/dev/null || { echo "ERROR: OCI CLI is required."; exit 2; }
command -v ssh-keygen >/dev/null || { echo "ERROR: ssh-keygen is required."; exit 2; }

TENANCY_OCID="$(awk -F= '/^tenancy=/{print $2; exit}' /etc/oci/config)"
[ -n "${TENANCY_OCID}" ] || { echo "ERROR: tenancy OCID not found in /etc/oci/config."; exit 2; }

COMPARTMENT_OCID="$(oci iam compartment list --compartment-id "${TENANCY_OCID}" --access-level ACCESSIBLE --compartment-id-in-subtree true --all --query 'data[?name==\`Grasshopper\` && "lifecycle-state"==\`ACTIVE\`].id | [0]' --raw-output)"
[ -n "${COMPARTMENT_OCID}" ] && [ "${COMPARTMENT_OCID}" != "null" ] || {
  echo "ERROR: Grasshopper compartment not found."
  exit 2
}

echo "== Grasshopper OCI destructive workstation rebuild =="
echo "Compartment: ${COMPARTMENT_OCID}"
echo "Region:      ${OCI_REGION}"
echo "Target:      ${NAME}"
echo

# Preserve the previous local key material for audit, then deliberately create a new identity.
if compgen -G "${SSH_DIR}/grasshopper_oci*" >/dev/null; then
  find "${SSH_DIR}" -maxdepth 1 -type f -name 'grasshopper_oci*' -exec mv -f {} "${ARCHIVE}/" \;
fi
ssh-keygen -t rsa -b 3072 -N "" -f "${KEY}" -C grasshopper-oci >/dev/null
chmod 600 "${KEY}" "${KEY}.pub"
echo "New workstation key: $(ssh-keygen -lf "${KEY}.pub" -E SHA256)"

# Destroy every non-terminated instance with the exact workstation name in this compartment.
mapfile -t IDS < <(oci compute instance list --compartment-id "${COMPARTMENT_OCID}" --display-name "${NAME}" --all --query 'data[?"lifecycle-state"!=\`TERMINATED\`].id' --raw-output | tr -d '[],"' | tr ' ' '\n' | sed '/^$/d')
for id in "${IDS[@]}"; do
  echo "Terminating old workstation: ${id}"
  oci compute instance terminate --instance-id "${id}" --preserve-boot-volume false --preserve-data-volumes-created-at-launch false --force --wait-for-state TERMINATED --max-wait-seconds 900 >/dev/null
done

AD="$(oci iam availability-domain list --compartment-id "${TENANCY_OCID}" --query 'data[0].name' --raw-output)"
VCN_OCID="$(oci network vcn list --compartment-id "${COMPARTMENT_OCID}" --display-name 'Grasshopper-VCN' --all --query 'data[0].id' --raw-output)"
SUBNET_OCID="$(oci network subnet list --compartment-id "${COMPARTMENT_OCID}" --display-name 'Grasshopper-Subnet' --all --query 'data[0].id' --raw-output)"
[ -n "${VCN_OCID}" ] && [ "${VCN_OCID}" != "null" ] || { echo "ERROR: Grasshopper-VCN missing."; exit 3; }
[ -n "${SUBNET_OCID}" ] && [ "${SUBNET_OCID}" != "null" ] || { echo "ERROR: Grasshopper-Subnet missing."; exit 3; }

IMAGE_OCID="$(oci compute image list --compartment-id "${TENANCY_OCID}" --operating-system 'Oracle Linux' --operating-system-version '9' --shape 'VM.Standard.A1.Flex' --all --query 'data[0].id' --raw-output)"
[ -n "${IMAGE_OCID}" ] && [ "${IMAGE_OCID}" != "null" ] || { echo "ERROR: Oracle Linux 9 A1 image unavailable."; exit 4; }

cat > "${ROOT}/oci-bootstrap-user-data.sh" <<'USERDATA'
#!/bin/bash
set -Eeuo pipefail
exec > >(tee -a /var/log/grasshopper-bootstrap.log) 2>&1
echo "GRASSHOPPER_BOOTSTRAP_BEGIN $(date -Is)"
dnf -y install git git-lfs curl wget jq unzip tar gzip tmux vim rsync ca-certificates openssh-clients python3 python3-pip gcc gcc-c++ make
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
  dnf -y install nodejs
fi
systemctl enable --now sshd
mkdir -p /home/opc/src
chown -R opc:opc /home/opc/src
if [ ! -d /home/opc/src/Grasshopper/.git ]; then
  su - opc -c 'git clone https://github.com/onnxscibroccoli/Grasshopper.git /home/opc/src/Grasshopper'
fi
su - opc -c 'cd /home/opc/src/Grasshopper && git fetch origin && git checkout main && git reset --hard origin/main && npm install && npm test'
touch /var/lib/grasshopper-bootstrap-complete
echo "GRASSHOPPER_BOOTSTRAP_COMPLETE $(date -Is)"
USERDATA

USER_DATA_B64="$(base64 -w0 "${ROOT}/oci-bootstrap-user-data.sh")"
INSTANCE_OCID="$(oci compute instance launch   --compartment-id "${COMPARTMENT_OCID}"   --availability-domain "${AD}"   --shape VM.Standard.A1.Flex   --display-name "${NAME}"   --subnet-id "${SUBNET_OCID}"   --assign-public-ip true   --image-id "${IMAGE_OCID}"   --shape-config '{"ocpus":2,"memoryInGBs":12}'   --ssh-authorized-keys-file "${KEY}.pub"   --user-data "${USER_DATA_B64}"   --freeform-tags '{"Project":"Grasshopper","Environment":"experimental","ProtectedBase":"AWS-Helix-Kali","Role":"agent-workstation","ManagedBy":"Grasshopper"}'   --wait-for-state RUNNING --max-wait-seconds 1200   --query 'data.id' --raw-output)"

VNIC_ID="$(oci compute instance list-vnics --instance-id "${INSTANCE_OCID}" --query 'data[0].id' --raw-output)"
PUBLIC_IP="$(oci network vnic get --vnic-id "${VNIC_ID}" --query 'data."public-ip"' --raw-output)"
PRIVATE_IP="$(oci network vnic get --vnic-id "${VNIC_ID}" --query 'data."private-ip"' --raw-output)"

cat > "${ENV_FILE}" <<EOF
TENANCY_OCID=${TENANCY_OCID}
COMPARTMENT_OCID=${COMPARTMENT_OCID}
REGION=${OCI_REGION}
AVAILABILITY_DOMAIN=${AD}
VCN_OCID=${VCN_OCID}
SUBNET_OCID=${SUBNET_OCID}
INSTANCE_OCID=${INSTANCE_OCID}
VNIC_OCID=${VNIC_ID}
PRIVATE_IP=${PRIVATE_IP}
PUBLIC_IP=${PUBLIC_IP}
SSH_KEY=${KEY}
EOF
chmod 600 "${ENV_FILE}"

echo
echo "INSTANCE_OCID=${INSTANCE_OCID}"
echo "PUBLIC_IP=${PUBLIC_IP}"
echo "PRIVATE_IP=${PRIVATE_IP}"
echo "SSH_KEY=${KEY}"
echo "Waiting for SSH and cloud-init convergence..."

for i in $(seq 1 60); do
  if ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 -o IdentitiesOnly=yes -i "${KEY}" "opc@${PUBLIC_IP}" 'echo OCI_SSH_OK' >/dev/null 2>&1; then
    break
  fi
  [ "${i}" -eq 60 ] && { echo "ERROR: SSH did not become ready."; exit 5; }
  sleep 10
done

ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o IdentitiesOnly=yes -i "${KEY}" "opc@${PUBLIC_IP}"   'for i in $(seq 1 90); do if [ -f /var/lib/grasshopper-bootstrap-complete ]; then echo GRASSHOPPER_BOOTSTRAP_COMPLETE; exit 0; fi; sleep 10; done; echo BOOTSTRAP_TIMEOUT; tail -100 /var/log/grasshopper-bootstrap.log; exit 6'

echo
echo "== OCI WORKSTATION READY =="
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o IdentitiesOnly=yes -i "${KEY}" "opc@${PUBLIC_IP}"   'echo "host=$(hostname)"; uname -a; node --version; git --version; python3 --version; cd ~/src/Grasshopper && git rev-parse HEAD && npm test'
