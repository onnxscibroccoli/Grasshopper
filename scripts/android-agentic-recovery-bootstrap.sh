#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

# Grasshopper Android orchestrator recovery bootstrap.
# Safe to run from RDC with:
# curl -fsSL https://raw.githubusercontent.com/onnxscibroccoli/Grasshopper/main/scripts/android-agentic-recovery-bootstrap.sh | bash
#
# This script is additive and fail-closed. It does not grant Android privileges,
# change production infrastructure, or replace a known-good Rish/Shizuku install.

ROOT="${GRASSHOPPER_ROOT:-$HOME/Grasshopper}"
BROCCOLI_ROOT="${BROCCOLI_ROOT:-$HOME/broccoli-core}"
BROCCOLI_URL="https://github.com/onnxscibroccoli/broccoli-core.git"
GRASSHOPPER_URL="https://github.com/onnxscibroccoli/Grasshopper.git"
STATE_DIR="$HOME/.config/grasshopper/android-orchestrator"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="$STATE_DIR/recovery-$STAMP"
mkdir -p "$REPORT"

log(){ printf '[android-recovery] %s\n' "$*"; }
pass(){ printf '[android-recovery] PASS %s\n' "$*"; }
warn(){ printf '[android-recovery] WARN %s\n' "$*" >&2; }
fail(){ printf '[android-recovery] FAIL %s\n' "$*" >&2; exit 1; }

command -v git >/dev/null || fail "git is required"
command -v bash >/dev/null || fail "bash is required"

log "capturing operator/device identity"
{
  date -Iseconds
  printf 'user='; id -un 2>/dev/null || true
  id 2>/dev/null || true
  printf 'device='; getprop ro.product.device 2>/dev/null || true
  printf 'model='; getprop ro.product.model 2>/dev/null || true
  printf 'sdk='; getprop ro.build.version.sdk 2>/dev/null || true
  printf 'termux_uid='; id -u 2>/dev/null || true
  printf 'pwd=%s\n' "$PWD"
} > "$REPORT/device-identity.txt"
pass "device identity captured"

clone_or_update(){
  local dir="$1" url="$2"
  if [ -d "$dir/.git" ]; then
    git -C "$dir" fetch --prune origin
    pass "repository refreshed: $dir"
  else
    git clone "$url" "$dir"
    pass "repository cloned: $dir"
  fi
}

clone_or_update "$BROCCOLI_ROOT" "$BROCCOLI_URL"
clone_or_update "$ROOT" "$GRASSHOPPER_URL"

log "creating local working-tree backups"
tar -czf "$REPORT/broccoli-core-working-tree.tgz" -C "$BROCCOLI_ROOT" --exclude=.git .
tar -czf "$REPORT/grasshopper-working-tree.tgz" -C "$ROOT" --exclude=.git .
pass "working-tree backups created"

log "capturing repository state"
{
  printf '%s\n' '=== broccoli-core ==='
  git -C "$BROCCOLI_ROOT" status --short --branch
  git -C "$BROCCOLI_ROOT" rev-parse HEAD
  printf '%s\n' '=== Grasshopper ==='
  git -C "$ROOT" status --short --branch
  git -C "$ROOT" rev-parse HEAD
} > "$REPORT/repositories.txt"

log "checking canonical Rish"
RISH="$BROCCOLI_ROOT/lib/rish_run.sh"
[ -r "$RISH" ] || fail "missing readable $RISH"

if [ -n "${BOOTCLASSPATH:-}" ]; then
  RISH_MODE="native-termux-environment"
else
  RISH_MODE="reduced-environment-adapter"
fi

rm -f /sdcard/GRASSHOPPER_ANDROID_ORCHESTRATOR_PROOF.txt
RISH_PRESERVE_ENV=0 bash "$RISH" '{
  echo GRASSHOPPER_ANDROID_ORCHESTRATOR_OK
  id
  echo sdk=$(getprop ro.build.version.sdk)
} > /sdcard/GRASSHOPPER_ANDROID_ORCHESTRATOR_PROOF.txt'

[ -s /sdcard/GRASSHOPPER_ANDROID_ORCHESTRATOR_PROOF.txt ] ||
  fail "Rish returned without target artifact"

grep -q 'uid=2000(shell)' /sdcard/GRASSHOPPER_ANDROID_ORCHESTRATOR_PROOF.txt ||
  fail "target artifact does not prove Android shell identity"

cp /sdcard/GRASSHOPPER_ANDROID_ORCHESTRATOR_PROOF.txt "$REPORT/rish-proof.txt"
pass "RDC -> Termux -> Rish -> Shizuku -> Android shell"

log "checking self-healing runtime components"
[ -x "$ROOT/scripts/termux-broccoli-supervisor.sh" ] &&
  pass "Grasshopper supervisor present" ||
  warn "supervisor script not present in checked-out revision"

[ -x "$HOME/.termux/boot/broccoli-supervisor" ] &&
  pass "Termux:Boot launcher present" ||
  warn "Termux:Boot launcher not installed"

if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock >/dev/null 2>&1 || warn "wake lock request failed"
  pass "wake lock requested"
else
  warn "termux-wake-lock unavailable"
fi

log "building cooperative agent workspace"
mkdir -p "$ROOT/.omnikali" "$ROOT/reports/android-orchestrator"
cat > "$ROOT/.omnikali/android-orchestrator-state.json.new" <<EOF
{
  "schema": "omnikali.android-orchestrator/v1",
  "captured_at": "$(date -Iseconds)",
  "transport": "RDC->Termux->Rish->Shizuku->Android-shell",
  "transport_status": "PASS",
  "operator_context": "current-Termux-user",
  "device": "$(getprop ro.product.device 2>/dev/null || true)",
  "sdk": "$(getprop ro.build.version.sdk 2>/dev/null || true)",
  "broccoli_core": "$BROCCOLI_ROOT",
  "grasshopper": "$ROOT",
  "rish_mode": "$RISH_MODE"
}
EOF
mv "$ROOT/.omnikali/android-orchestrator-state.json.new" "$ROOT/.omnikali/android-orchestrator-state.json"
cp "$REPORT/rish-proof.txt" "$ROOT/reports/android-orchestrator/latest-rish-proof.txt"

cat > "$REPORT/RECOVERY_MANIFEST.txt" <<EOF
schema=grasshopper.android-recovery/v1
captured_at=$(date -Iseconds)
transport=PASS
rish_target_artifact=PASS
operator_access=current-Termux-user
privileged_android_shell=uid=2000(shell)
production_mutation=NONE
EOF

pass "recovery manifest written: $REPORT"
log "Android agentic recovery bootstrap complete"
printf 'REPORT=%s\n' "$REPORT"
