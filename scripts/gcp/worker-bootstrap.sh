#!/bin/bash
set -euo pipefail
GRASSHOPPER_REF="${GRASSHOPPER_REF:-main}"
BROCCOLI_REF="${BROCCOLI_REF:-main}"
GRASSHOPPER_DIR="${GRASSHOPPER_DIR:-/opt/omnikali/src/Grasshopper}"
BROCCOLI_DIR="${BROCCOLI_DIR:-/opt/omnikali/src/broccoli-core}"
STATE_DIR="${STATE_DIR:-/var/lib/omnikali}"
NODE_VERSION="${NODE_VERSION:-22.23.3}"
WORKER_USER="${WORKER_USER:-omnikali}"
fail(){ echo "GCP_BOOTSTRAP_FAIL: $*" >&2; exit 1; }
need(){ command -v "$1" >/dev/null 2>&1 || fail "missing command: $1"; }
[[ $EUID -eq 0 ]] || fail "run as root"
need apt-get; need curl
HTTP=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Metadata-Flavor: Google' http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip || true)
[[ "$HTTP" == "404" ]] || fail "worker must have no external IPv4 address; metadata HTTP=$HTTP"
curl -fsS https://api.github.com/zen >/dev/null || fail "GitHub HTTPS egress unavailable; configure Cloud NAT or equivalent"
apt-get update
apt-get install -y ca-certificates curl git python3 python3-venv python3-pip jq sqlite3 xz-utils
id "$WORKER_USER" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "$WORKER_USER"
install -d -o "$WORKER_USER" -g "$WORKER_USER" /opt/omnikali/src "$STATE_DIR"/github-index "$STATE_DIR"/broccoli/archive-journal "$STATE_DIR"/checkpoints "$STATE_DIR"/evidence
case "$(dpkg --print-architecture)" in amd64) NODE_ARCH=x64;; arm64) NODE_ARCH=arm64;; *) fail "unsupported architecture";; esac
TARBALL="node-v$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
cd /tmp
curl -fsSLO "https://nodejs.org/dist/v$NODE_VERSION/$TARBALL"
curl -fsSLO "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
grep "  $TARBALL$" SHASUMS256.txt | sha256sum -c -
rm -rf "/opt/node-v$NODE_VERSION-linux-$NODE_ARCH"
tar -xJf "$TARBALL" -C /opt
ln -sfn "/opt/node-v$NODE_VERSION-linux-$NODE_ARCH" /opt/node
ln -sfn /opt/node/bin/node /usr/local/bin/node
ln -sfn /opt/node/bin/npm /usr/local/bin/npm
node --version | grep -Fx "v$NODE_VERSION" >/dev/null || fail "unexpected Node version"
clone_or_verify(){
  url="$1"; dir="$2"; ref="$3"
  if [[ -d "$dir/.git" ]]; then
    git -C "$dir" fetch --filter=blob:none --no-tags origin "$ref"
  else
    rm -rf "$dir"; install -d -o "$WORKER_USER" -g "$WORKER_USER" "$(dirname "$dir")"
    git clone --filter=blob:none --no-checkout "$url" "$dir"
    git -C "$dir" fetch --filter=blob:none --no-tags origin "$ref"
  fi
  git -C "$dir" checkout --detach "origin/$ref" >/dev/null
  chown -R "$WORKER_USER:$WORKER_USER" "$dir"
}
clone_or_verify https://github.com/onnxscibroccoli/Grasshopper.git "$GRASSHOPPER_DIR" "$GRASSHOPPER_REF"
clone_or_verify https://github.com/onnxscibroccoli/broccoli-core.git "$BROCCOLI_DIR" "$BROCCOLI_REF"
sudo -u "$WORKER_USER" bash -lc "
set -e
cd '$GRASSHOPPER_DIR'
npm install
npm test
python3 -m py_compile tools/github-ingest/github_ingest.py tools/github-ingest/query.py
export OMNIKALI_GITHUB_INDEX_ROOT='$STATE_DIR/github-index'
export OMNIKALI_GITHUB_API_ONLY=1
export OMNIKALI_GITHUB_MAX_TEXT_FILES=300
python3 tools/github-ingest/github_ingest.py sync onnxscibroccoli/Grasshopper --ref '$GRASSHOPPER_REF'
python3 tools/github-ingest/github_ingest.py sync onnxscibroccoli/broccoli-core --ref '$BROCCOLI_REF'
python3 tools/github-ingest/github_ingest.py status
"
cat > "$STATE_DIR/worker-source.json" <<EOF
{"schema":"omnikali-gcp-worker-source/v1","grasshopper_ref":"$GRASSHOPPER_REF","grasshopper_commit":"$(git -C "$GRASSHOPPER_DIR" rev-parse HEAD)","broccoli_ref":"$BROCCOLI_REF","broccoli_commit":"$(git -C "$BROCCOLI_DIR" rev-parse HEAD)","node":"$(node --version)","architecture":"$(dpkg --print-architecture)","external_ipv4":false,"github_api_only":true}
EOF
chown "$WORKER_USER:$WORKER_USER" "$STATE_DIR/worker-source.json"
echo GCP_BOOTSTRAP_PASS
cat "$STATE_DIR/worker-source.json"
