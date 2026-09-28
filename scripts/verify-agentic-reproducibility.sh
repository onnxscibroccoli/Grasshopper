#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
command -v git >/dev/null 2>&1 || { echo "git is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || { echo "Node.js 20+ is required; found $(node --version)" >&2; exit 1; }
cd "$ROOT"
if [ -n "$(git status --porcelain)" ]; then
  echo "working tree is dirty; commit the canonical source before reproducibility verification" >&2
  exit 1
fi
COMMIT=$(git rev-parse HEAD)
REMOTE=$(git config --get remote.origin.url || true)
TMP=$(mktemp -d "${TMPDIR:-/tmp}/grasshopper-repro.XXXXXX")
trap 'rm -rf "$TMP"' EXIT HUP INT TERM
mkdir -p "$TMP/source"
git archive --format=tar "$COMMIT" | tar -xf - -C "$TMP/source"
[ ! -e "$TMP/source/.state" ] || { echo "source archive unexpectedly contains .state" >&2; exit 1; }
if find "$TMP/source" -type f \( -name '*.pem' -o -name '*.key' -o -name '*.p12' \) -print -quit | grep -q .; then
  echo "source archive contains private-key material" >&2
  exit 1
fi
cd "$TMP/source"
./scripts/bootstrap.sh
npm test
npm run verify:reference >/dev/null
STATUS=$(node bin/omnikali.mjs status)
node -e '
const s=JSON.parse(process.argv[1]);
if (!s.agents || Object.keys(s.agents).length !== 1) throw new Error("bootstrap did not register exactly one reference agent");
if (!s.resources || Object.keys(s.resources).length !== 1) throw new Error("bootstrap did not declare exactly one reference resource");
' "$STATUS"
printf '%s\n' "Agentic MVP reproducibility: PASS"
printf '%s\n' "canonical_commit=$COMMIT"
printf '%s\n' "node=$(node --version)"
printf '%s\n' "npm=$(npm --version)"
printf '%s\n' "source_remote=$REMOTE"
printf '%s\n' "reconstructed_from_clean_git_archive=true"
printf '%s\n' "production_credentials_required=false"
printf '%s\n' "live_production_mutation_performed=false"
