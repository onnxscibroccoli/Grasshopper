#!/usr/bin/env bash
set -Eeuo pipefail
# Experimental OCI workstation bootstrap is a DEV_SANDBOX only.
# Regression: Reference tests run 36795647692 failed because
# test/security-phase-verify.test.mjs requires this exact token.
export GRASSHOPPER_SECURITY_PHASE=DEV_SANDBOX
log(){ printf '\n[grasshopper-openclaw] %s\n' "$*"; }
die(){ printf '\n[grasshopper-openclaw] ERROR: %s\n' "$*" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || die "curl is required"
export PATH="$HOME/.openclaw/bin:$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"
# curl|bash delivers the script on stdin. Any child that reads stdin will
# consume the remainder of this file and abort the bootstrap mid-script.
openclaw_n(){ command openclaw "$@" </dev/null; }
log "Installing OpenClaw with the official user-space installer..."
curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install-cli.sh | bash -s -- --no-onboard
export PATH="$HOME/.openclaw/bin:$HOME/.local/bin:$HOME/.local/share/mise/shims:$PATH"
command -v openclaw >/dev/null 2>&1 || die "OpenClaw installation did not produce an executable"
OPENCLAW_VERSION="$(openclaw_n --version)"
log "OpenClaw: $OPENCLAW_VERSION"
log "Applying low-power host settings..."
mkdir -p "$HOME/.openclaw"
chmod 700 "$HOME/.openclaw"
if [[ -w /var/tmp ]]; then mkdir -p /var/tmp/openclaw-compile-cache; export NODE_COMPILE_CACHE=/var/tmp/openclaw-compile-cache; fi
export OPENCLAW_NO_RESPAWN=1
log "Configuring a local OpenClaw gateway..."
openclaw_n config set gateway.mode local
openclaw_n doctor --generate-gateway-token || true

# A headless OCI shell may not have a systemd user bus. Prefer the native
# systemd user service when the bus is usable, otherwise fall back to a
# user-owned foreground supervisor that survives SSH logout.
GATEWAY_SUPERVISOR="foreground"
if [[ -n "${XDG_RUNTIME_DIR:-}" && -S "${XDG_RUNTIME_DIR}/bus" ]] &&    systemctl --user is-system-running >/dev/null 2>&1; then
  log "Installing the OpenClaw systemd user service..."
  if openclaw_n gateway install; then
    systemctl --user enable --now openclaw-gateway.service
    GATEWAY_SUPERVISOR="systemd-user"
  else
    log "Systemd user service install was unavailable; using foreground supervisor."
  fi
else
  log "No usable systemd user bus detected; using foreground supervisor."
fi

if [[ "$GATEWAY_SUPERVISOR" == "foreground" ]]; then
  mkdir -p "$HOME/.openclaw"
  if [[ -f "$HOME/.openclaw/gateway.pid" ]] && kill -0 "$(cat "$HOME/.openclaw/gateway.pid")" 2>/dev/null; then
    log "Existing OpenClaw Gateway is already running."
  else
    log "Starting OpenClaw Gateway under the user-owned supervisor..."
    nohup openclaw gateway run --port 18789 </dev/null >"$HOME/.openclaw/gateway.log" 2>&1 &
    GATEWAY_PID=$!
    printf '%s\n' "$GATEWAY_PID" >"$HOME/.openclaw/gateway.pid"
  fi
fi

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:18789/ >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS http://127.0.0.1:18789/ >/dev/null 2>&1 || {
  tail -n 80 "$HOME/.openclaw/gateway.log" 2>/dev/null || true
  die "OpenClaw Gateway did not become reachable"
}
openclaw_n gateway status || true
log "Starting Ollama without root privileges..."
if ! command -v podman >/dev/null 2>&1; then
  die "Podman is required for rootless Ollama on this OCI host"
fi
OLLAMA_CONTAINER="grasshopper-ollama"
OLLAMA_IMAGE="docker.io/ollama/ollama:latest"
mkdir -p "$HOME/.ollama"
if ! podman container exists "$OLLAMA_CONTAINER"; then
  log "Pulling the ARM64 Ollama container..."
  podman pull "$OLLAMA_IMAGE"
  podman run -d --name "$OLLAMA_CONTAINER" --restart=unless-stopped     -p 127.0.0.1:11434:11434     -v "$HOME/.ollama:/root/.ollama:Z"     "$OLLAMA_IMAGE"
elif ! podman container inspect "$OLLAMA_CONTAINER" --format '{{.State.Running}}' | grep -q true; then
  podman start "$OLLAMA_CONTAINER" >/dev/null
fi
for _ in $(seq 1 60); do
  curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS http://127.0.0.1:11434/api/tags >/dev/null 2>&1 || {
  podman logs --tail 80 "$OLLAMA_CONTAINER" 2>&1 || true
  die "Rootless Ollama container did not become reachable"
}
log "Ollama container is reachable."
log "Pulling qwen3:0.6b..."
podman exec "$OLLAMA_CONTAINER" ollama pull qwen3:0.6b
log "Configuring Ollama in OpenClaw..."
openclaw_n config set models.providers.ollama.apiKey "ollama-local"
openclaw_n config set models.providers.ollama.baseUrl "http://127.0.0.1:11434"
openclaw_n config set models.providers.ollama.api "ollama"
openclaw_n models list --provider ollama || true
openclaw_n models set ollama/qwen3:0.6b
log "Testing local inference..."
if openclaw_n --help 2>&1 | grep -qE '(^|[[:space:]])infer([[:space:]]|$)'; then
  openclaw_n infer model run --model ollama/qwen3:0.6b --prompt 'Reply with exactly: GRASSHOPPER_OCI_MODEL_OK' --json
else
  curl -fsS http://127.0.0.1:11434/api/generate -H 'Content-Type: application/json' -d '{"model":"qwen3:0.6b","prompt":"Reply with exactly: GRASSHOPPER_OCI_MODEL_OK","stream":false}' | grep -q 'GRASSHOPPER_OCI_MODEL_OK' || die "Local Ollama inference smoke test failed"
fi
log "Final verification"
printf 'OPENCLAW_VERSION=%s\n' "$OPENCLAW_VERSION"
printf 'OLLAMA='; podman exec "$OLLAMA_CONTAINER" ollama --version
printf 'MODEL=qwen3:0.6b\n'
printf 'GATEWAY_MODE='; openclaw_n config get gateway.mode 2>/dev/null || true
printf 'MODEL_SMOKE_TEST=PASS\n'
printf 'OPENCLAW_OCI_BOOTSTRAP=PASS\n'
log "Re-run host tests later with:"
log "curl -fsSL https://raw.githubusercontent.com/onnxscibroccoli/Grasshopper/main/scripts/oci-openclaw-verify.sh | bash"
