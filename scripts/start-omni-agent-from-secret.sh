#!/bin/sh
set -eu

: "${OMNIKALI_AWS_REGION:?OMNIKALI_AWS_REGION is required}"
: "${OMNIKALI_AGENT_SECRET_ID:?OMNIKALI_AGENT_SECRET_ID is required}"

secret_json=$(
  /usr/bin/aws secretsmanager get-secret-value \
    --region "$OMNIKALI_AWS_REGION" \
    --secret-id "$OMNIKALI_AGENT_SECRET_ID" \
    --query SecretString \
    --output text
)

export AGENT_TOKEN=$(
  printf '%s' "$secret_json" | /usr/bin/python3 -c 'import json,sys; s=json.load(sys.stdin); v=s.get("AGENT_TOKEN"); raise SystemExit("AGENT_TOKEN missing") if not isinstance(v,str) or not v else print(v, end="")'
)
unset secret_json

exec /usr/bin/node /opt/omnikali/src/production/omni-agent.mjs
