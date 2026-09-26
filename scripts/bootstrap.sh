#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
mkdir -p .state
node bin/omnikali.mjs agent reference-agent >/dev/null
node bin/omnikali.mjs resource workspace >/dev/null
printf '%s\n' 'OmniKali reference bootstrapped.'
printf '%s\n' 'Run: npm test && node bin/omnikali.mjs status'
