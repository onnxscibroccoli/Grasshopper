#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || { echo "Node.js 20+ is required; found $(node --version)" >&2; exit 1; }

mkdir -p .state
node bin/omnikali.mjs agent reference-agent >/dev/null
node bin/omnikali.mjs resource workspace >/dev/null

printf '%s\n' 'OmniKali reference bootstrapped.'
printf '%s\n' 'Run: npm run verify:reference'
