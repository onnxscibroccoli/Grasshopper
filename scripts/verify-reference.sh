#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

./scripts/bootstrap.sh >/dev/null
npm test
node scripts/validate-production-agent-artifact.mjs
node scripts/validate-canonical-agent-source.mjs
sh -n scripts/start-omni-agent-from-secret.sh
node bin/omnikali.mjs status >/dev/null

test -f .state/omnikali.json
MODE=$(stat -c '%a' .state/omnikali.json 2>/dev/null || stat -f '%Lp' .state/omnikali.json)
test "$MODE" = "600"

printf '%s\n' 'OmniKali reference verification passed.'
