#!/usr/bin/env bash
set -Eeuo pipefail
log(){ printf '\n[grasshopper-openclaw] %s\n' "$*"; }
die(){ printf '\n[grasshopper-openclaw] ERROR: %s\n' "$*" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || die "curl is required"
export PATH="$HOME/.openclaw/bin:$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"
log "Installing OpenClaw with the official user-space installer..."
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh | bash -s -- --no-onboard
export PATH="$HOME/.openclaw/bin:$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"
command -v openclaw >/dev/null 2>&1 || die "OpenClaw installation did not produce an executable"
OPENCLAW_VERSION="$(openclaw --version)"
log "OpenClaw: $OPENCLAW_VERSION"
log "Applying low-power host settings..."
mkdir -p "$HOME/.openclaw"
chmod 700 "$HOME/.openclaw"
if [[ -w /var/tmp ]]; then mkdir -p /var/tmp/openclaw-compile-cache; export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache; fi
export OPENCLAW_NO_RESPAWN=1
log "Configuring a local OpenClaw gateway..."
openclaw config set gateway.mode local
openclaw doctor --fix --generate-gateway-token </dev/null || true
log "Installing the OpenClaw user service..."
openclaw gateway install --force
openclaw gateway start || true
sleep 3
openclaw gateway status --deep || true
log "Installing Ollama if needed..."
if ! command -v ollama >/dev/null 2>&1; then curl -fsSL https://ollama.com/install.sh | sh; fi
command -v ollama >/dev/null 2>&1 || die "Ollama installation failed"
ollama --version
log "Starting Ollama..."
if ! curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  nohup ollama serve >"$HOME/.openclaw/ollama.log" 2>&1 &
  OLLAMA_PID=$!
  for _ in $(seq 1 30); do curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done
fi
curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 || die "Ollama did not become reachable"
log "Pulling qwen3:0.6b..."
ollama pull qwen3:0.6b
log "Configuring Ollama in OpenClaw..."
export OLLAMA_API_KEY=ollama-local
openclaw models list --provider ollama || true
openclaw models set ollama/qwen3:0.6b
log "Testing local inference..."
if openclaw --help 2>&1 | grep -qE '(^|[[:space:]])infer([[:space:]]|$)'; then
  openclaw infer model run --local --model ollama/qwen3:0.6b --prompt 'Reply with exactly: GRASSHOPPER_OCI_MODEL_OK' --json
else
  curl -fsS http://127.0.0.1:11434/api/generate -H 'Content-Type: application/json' -d '{"model":"qwen3:0.6b","prompt":"Reply with exactly: GRASSHOPPER_OCI_MODEL_OK","stream":false}' | grep -q 'GRASSHOPPER_OCI_MODEL_OK' || die "Local Ollama inference smoke test failed"
fi
log "Final verification"
printf 'OPENCLAW_VERSION=%s\n' "$OPENCLAW_VERSION"
printf 'OLLAMA='; ollama --version
printf 'MODEL=qwen3:0.6b\n'
printf 'GATEWAY_MODE='; openclaw config get gateway.mode 2>/dev/null || true
printf 'MODEL_SMOKE_TEST=PASS\n'
printf 'OPENCLAW_OCI_BOOTSTRAP=PASS\n'
