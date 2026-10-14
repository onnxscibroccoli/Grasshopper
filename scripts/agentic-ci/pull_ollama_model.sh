#!/usr/bin/env bash
# Three attempts total for the local Llama 3.2 pull. Linear waits: 10s, 20s.
# Verify both the API success response and the model in /api/tags.
# No static credentials, no model-generated commands, no false-PASS fallback.
set -Eeuo pipefail
umask 077

model="${1:-llama3.2:3b}"
if [[ "$model" != 'llama3.2:3b' && "$model" != 'deepseek-coder:6.7b-instruct' ]]; then
  echo 'OLLAMA_PULL=BLOCKED_UNAPPROVED_MODEL' >&2
  exit 2
fi

endpoint='http://127.0.0.1:11434'
tmp="$(mktemp -d)"
trap 'rm -rf -- "$tmp"' EXIT

for attempt in 1 2 3; do
  echo "OLLAMA_PULL_ATTEMPT=${attempt}/3"
  response="$tmp/pull-${attempt}.json"
  tags="$tmp/tags-${attempt}.json"
  if curl --fail --silent --show-error --connect-timeout 15 --max-time 540 \
      --header 'Content-Type: application/json' \
      --data "$(printf '{\"name\":\"%s\",\"stream\":false}' \"$model\")" \
      --output "$response" "$endpoint/api/pull"; then
    if python3 - "$response" <<'PY'
import json, sys
try:
    with open(sys.argv[1], encoding='utf-8') as handle:
        data = json.load(handle)
    success = isinstance(data, dict) and data.get('status') == 'success' and not data.get('error')
except (OSError, UnicodeError, ValueError):
    success = False
sys.exit(0 if success else 1)
PY
    then
      if curl --fail --silent --show-error --connect-timeout 15 --max-time 15 \
          --output "$tags" "$endpoint/api/tags"; then
        if python3 - "$tags" "$model" <<'PY'
import json, sys
try:
    with open(sys.argv[1], encoding='utf-8') as handle:
        data = json.load(handle)
    available = isinstance(data, dict) and any(
        isinstance(item, dict) and sys.argv[2] in (item.get('name'), item.get('model'))
        for item in data.get('models', [])
    )
except (OSError, UnicodeError, ValueError, TypeError):
    available = False
sys.exit(0 if available else 1)
PY
        then
          echo "OLLAMA_PULL=PASS"
          echo "OLLAMA_PULL_VERIFIED_ATTEMPT=$attempt"
          exit 0
        fi
      fi
    fi
  fi
  echo "OLLAMA_PULL_ATTEMPT_${attempt}=FAILED_OR_UNVERIFIED" >&2
  if (( attempt < 3 )); then
    wait_seconds=$((10 * attempt))
    echo "OLLAMA_PULL_LINEAR_BACKOFF_SECONDS=$wait_seconds"
    sleep "$wait_seconds"
  fi
done

echo 'OLLAMA_PULL=FAIL_AFTER_3_ATTEMPTS' >&2
exit 1
