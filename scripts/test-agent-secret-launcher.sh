#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
LAUNCHER="$ROOT/scripts/start-omni-agent-from-secret.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT HUP INT TERM

mkdir -p "$TMP/bin"

cat >"$TMP/bin/aws" <<'EOF'
#!/bin/sh
set -eu
cat <<'JSON'
{"AGENT_TOKEN":"test-only-token"}
JSON
EOF

cat >"$TMP/bin/python3" <<'EOF'
#!/usr/bin/env python3
import json
import sys

payload = json.load(sys.stdin)
value = payload.get("AGENT_TOKEN")
if not isinstance(value, str) or not value:
    raise SystemExit("AGENT_TOKEN missing")
print(value, end="")
EOF

cat >"$TMP/bin/node" <<'EOF'
#!/bin/sh
set -eu
test "$1" = "/opt/helix/src/production/omni-agent.mjs"
test "${AGENT_TOKEN:-}" = "test-only-token"
printf '%s\n' "secret launcher reconstruction harness passed"
EOF

chmod 700 "$TMP/bin/"*
sed \
  -e "s#/usr/bin/aws#$TMP/bin/aws#g" \
  -e "s#/usr/bin/python3#$TMP/bin/python3#g" \
  -e "s#/usr/bin/node#$TMP/bin/node#g" \
  "$LAUNCHER" >"$TMP/launcher.sh"
chmod 700 "$TMP/launcher.sh"

output=$(
  OMNIKALI_AWS_REGION=us-east-1 \
  OMNIKALI_AGENT_SECRET_ID=test-only-secret-reference \
  "$TMP/launcher.sh"
)

test "$output" = "secret launcher reconstruction harness passed"
! printf '%s' "$output" | grep -Fq 'test-only-token'

printf '%s\n' "Agent secret launcher reconstruction harness passed."
