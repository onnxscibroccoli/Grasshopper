#!/usr/bin/env bash
set -Eeuo pipefail

REPO="https://github.com/onnxscibroccoli/Grasshopper.git"
WORKSPACE="${HOME}/src/Grasshopper"
STATE_DIR="${HOME}/.grasshopper"
AUDIT_DIR="${STATE_DIR}/audit"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
LOG="${AUDIT_DIR}/agent-bootstrap-${STAMP}.log"

mkdir -p "${AUDIT_DIR}" "${STATE_DIR}/bin"
exec > >(tee -a "${LOG}") 2>&1

echo "=== Grasshopper OCI agent bootstrap ==="
date -u -Is
hostname
id

echo "--- package prerequisites ---"
sudo dnf -y install git curl jq openssh-clients ca-certificates tar gzip unzip
if ! command -v rg >/dev/null 2>&1; then
  echo "WARN: ripgrep package is unavailable in the configured Oracle Linux repositories; continuing with grep-compatible tooling."
fi

echo "--- user-local PATH ---"
PROFILE="${HOME}/.bashrc"
grep -qF 'export PATH="$HOME/.local/bin:$HOME/.grasshopper/bin:$PATH"' "${PROFILE}" 2>/dev/null ||   printf '\nexport PATH="$HOME/.local/bin:$HOME/.grasshopper/bin:$PATH"\n' >> "${PROFILE}"
export PATH="${HOME}/.local/bin:${HOME}/.grasshopper/bin:${PATH}"
mkdir -p "${HOME}/.local/bin"

echo "--- GitHub SSH host verification ---"
mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh"
touch "${HOME}/.ssh/known_hosts"
chmod 600 "${HOME}/.ssh/known_hosts"
ssh-keyscan -t ed25519 github.com 2>/dev/null | sort -u >> "${HOME}/.ssh/known_hosts.tmp"
sort -u "${HOME}/.ssh/known_hosts.tmp" > "${HOME}/.ssh/known_hosts"
rm -f "${HOME}/.ssh/known_hosts.tmp"

echo "--- OpenCode ---"
if ! command -v opencode >/dev/null 2>&1; then
  curl -fsSL https://opencode.ai/v2/install | bash
fi

echo "--- Claude Code ---"
if ! command -v claude >/dev/null 2>&1; then
  curl -fsSL https://claude.ai/install.sh | bash
fi

echo "--- versions ---"
git --version
node --version
python3 --version
opencode --version || true
claude --version || true

echo "--- repository ---"
if [[ ! -d "${WORKSPACE}/.git" ]]; then
  mkdir -p "$(dirname "${WORKSPACE}")"
  git clone "${REPO}" "${WORKSPACE}"
fi
git -C "${WORKSPACE}" config --local core.autocrlf false
git -C "${WORKSPACE}" config --local fetch.prune true
git -C "${WORKSPACE}" status --short --branch
git -C "${WORKSPACE}" log -1 --oneline

echo "--- OCI instance-principal probe ---"
if command -v oci >/dev/null 2>&1; then
  OCI_CLI_AUTH=instance_principal oci os ns get >/dev/null 2>&1 &&     echo "OCI_INSTANCE_PRINCIPAL=AVAILABLE" ||     echo "OCI_INSTANCE_PRINCIPAL=NOT_AUTHORIZED_OR_UNCONFIGURED"
fi

echo "--- audit manifest ---"
cat > "${AUDIT_DIR}/current.json" <<EOF
{
  "timestamp_utc": "${STAMP}",
  "hostname": "$(hostname)",
  "repo": "${REPO}",
  "workspace": "${WORKSPACE}",
  "git_commit": "$(git -C "${WORKSPACE}" rev-parse HEAD 2>/dev/null || true)",
  "git_branch": "$(git -C "${WORKSPACE}" branch --show-current 2>/dev/null || true)",
  "git_status": "$(git -C "${WORKSPACE}" status --porcelain=v1 2>/dev/null | jq -R -s .)",
  "node": "$(node --version 2>/dev/null || true)",
  "python": "$(python3 --version 2>/dev/null || true)",
  "opencode": "$(opencode --version 2>/dev/null || true)",
  "claude": "$(claude --version 2>/dev/null || true)"
}
EOF

chmod 600 "${AUDIT_DIR}/current.json"
echo "AGENT_BOOTSTRAP_COMPLETE $(date -u -Is)"
echo "AUDIT_LOG=${LOG}"

# Refresh capabilities after bootstrap; installed tools do not prove authentication.
node "${WORKSPACE}/scripts/workstation-capabilities.mjs" "${AUDIT_DIR}/capabilities.json"
