#!/usr/bin/env bash
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
MANIFEST="$ROOT/manifests/remote-desktop-production.json"
DOC="$ROOT/docs/FULL_REMOTE_DESKTOP_REPRODUCIBILITY.md"

fail() { echo "FULL REMOTE DESKTOP REPRODUCIBILITY: FAIL: $*" >&2; exit 1; }
pass() { echo "FULL REMOTE DESKTOP REPRODUCIBILITY: PASS: $*"; }

command -v git >/dev/null || fail "git is required"
command -v node >/dev/null || fail "node is required"
[[ -f "$MANIFEST" ]] || fail "manifest missing"
[[ -f "$DOC" ]] || fail "gate documentation missing"

node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$MANIFEST" ||
  fail "manifest is not valid JSON"

grep -q '"status": "incomplete_until_full_path_acceptance"' "$MANIFEST" ||
  fail "manifest must remain fail-closed until full acceptance"

required=(
  aws-network iam ec2-nested-kvm encrypted-persistent-ebs
  kali-guest-image xfce firefox qemu-guest-agent libvirt
  postgresql helix-gateway oidc-session cloudfront dashboard
  desktop-websocket novnc-rfb
)
for layer in "${required[@]}"; do
  grep -q "\"$layer\"" "$MANIFEST" || fail "required layer missing: $layer"
done

for forbidden in 'manual package installation' 'manual secret copying' 'manual browser-cookie transfer'; do
  grep -q "$forbidden" "$MANIFEST" || fail "human boundary missing: $forbidden"
done

if git -C "$ROOT" status --porcelain | grep -q .; then
  fail "working tree is dirty"
fi

echo "Required full-path layers: ${#required[@]}"
echo "Production credentials required by verifier: false"
echo "Live production mutation performed by verifier: false"
pass "contract inventory is present and fail-closed"
echo "NOTE: this verifier intentionally does NOT claim AWS/desktop/browser acceptance."
