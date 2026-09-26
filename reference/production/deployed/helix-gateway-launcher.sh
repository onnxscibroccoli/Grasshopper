#!/bin/sh
set -eu
set -a
. /etc/helix/agent.env
set +a

# Production launcher behavior recovered from the live host.
# The secret-manager reference is intentionally supplied by deployment configuration,
# not embedded in this reference artifact.
secret_json=$(/usr/bin/aws secretsmanager get-secret-value --region us-east-1 --secret-id "$HELIX_DB_SECRET_ARN" --query SecretString --output text)
export DATABASE_URL=$(printf '%s' "$secret_json" | /usr/bin/python3 -c 'import json,sys; from urllib.parse import quote; s=json.load(sys.stdin); print("postgresql://"+quote(s["username"],safe="")+":"+quote(s["password"],safe="")+"@<production-rds-endpoint>:5432/helix?sslmode=require&uselibpqcompat=true")')
unset secret_json
exec /bin/sh /opt/helix/production/gateway/start-helix-gateway.sh
