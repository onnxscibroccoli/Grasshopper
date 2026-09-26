#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"

./scripts/bootstrap.sh >/dev/null
npm test
node bin/omnikali.mjs status >/dev/null

test -f .state/omnikali.json
MODE=$(stat -c '%a' .state/omnikali.json 2>/dev/null || stat -f '%Lp' .state/omnikali.json)
test "$MODE" = "600"

printf '%s\n' 'OmniKali reference verification passed.'
