import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const bootstrapPath = "scripts/oci-openclaw-bootstrap.sh";
const verifyPath = "scripts/oci-openclaw-verify.sh";
const bootstrap = fs.readFileSync(bootstrapPath, "utf8");
const verify = fs.readFileSync(verifyPath, "utf8");

function hasBareOpenclawCommand(line) {
  const stripped = line
    .replaceAll("openclaw_n", "OC_N")
    .replaceAll("command -v openclaw", "CMD_V");
  return /(?:^|[;&|]\s*|\bnohup\s+)openclaw(?:\s|$)/.test(stripped);
}

function unsafeOpenclawLines(source) {
  return source
    .split("\n")
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => {
      if (!line || line.startsWith("#")) return false;
      if (line.startsWith("openclaw_n()")) return false;
      if (!hasBareOpenclawCommand(line)) return false;
      return !line.includes("</dev/null");
    });
}

test("OCI OpenClaw bootstrap is curl-pipe safe and closes stdin on CLI", () => {
  assert.match(bootstrap, /^#!/);
  assert.match(bootstrap, /set -Eeuo pipefail/);
  assert.match(bootstrap, /openclaw_n\(\)\{ command openclaw "\$@" <\/dev\/null; \}/);
  assert.match(bootstrap, /https:\/\/openclaw\.ai\/install-cli\.sh/);
  assert.match(bootstrap, /gateway\.mode local/);
  assert.match(bootstrap, /127\.0\.0\.1:18789/);
  assert.match(bootstrap, /127\.0\.0\.1:11434/);
  assert.match(bootstrap, /grasshopper-ollama/);
  assert.match(bootstrap, /qwen3:0\.6b/);
  assert.match(bootstrap, /OPENCLAW_OCI_BOOTSTRAP=PASS/);
  assert.match(bootstrap, /oci-openclaw-verify\.sh/);
  assert.match(bootstrap, /loginctl enable-linger "\$USER"/);
  assert.match(bootstrap, /XDG_RUNTIME_DIR=/);
  assert.match(bootstrap, /nohup openclaw gateway run --port 18789 <\/dev\/null/);
  assert.doesNotMatch(bootstrap, /dirname -- "\$0"/);
  assert.doesNotMatch(bootstrap, /\bsource\s+/);
  assert.deepEqual(unsafeOpenclawLines(bootstrap), []);
});

test("OCI OpenClaw verify is a read-only curl-pipe host test", () => {
  assert.match(verify, /^#!/);
  assert.match(verify, /set -Eeuo pipefail/);
  assert.match(
    verify,
    /curl -fsSL https:\/\/raw\.githubusercontent\.com\/onnxscibroccoli\/Grasshopper\/main\/scripts\/oci-openclaw-verify\.sh \| bash/,
  );
  assert.match(verify, /openclaw_n\(\)\{ command openclaw "\$@" <\/dev\/null; \}/);
  assert.match(verify, /Does not install packages/);
  assert.match(verify, /OPENCLAW_OCI_VERIFY=PASS/);
  assert.match(verify, /ollama\.generate\.smoke/);
  assert.match(verify, /openclaw\.gateway\.listen\.not_public/);
  assert.match(verify, /openclaw\.user\.linger/);
  assert.match(verify, /openclaw\.gateway\.systemd\.enabled/);
  assert.match(verify, /openclaw\.gateway\.systemd\.active/);
  assert.match(verify, /GRASSHOPPER_OCI_MODEL_OK/);
  assert.doesNotMatch(verify, /dirname -- "\$0"/);
  assert.doesNotMatch(verify, /\bsource\s+/);
  assert.doesNotMatch(verify, /config set /);
  assert.doesNotMatch(verify, /podman pull/);
  assert.doesNotMatch(verify, /podman run/);
  assert.doesNotMatch(verify, /gateway install/);
  assert.doesNotMatch(verify, /gateway run/);
  assert.doesNotMatch(verify, /ollama pull/);
  assert.doesNotMatch(verify, /install-cli\.sh/);
  assert.deepEqual(unsafeOpenclawLines(verify), []);
});

test("OCI OpenClaw scripts keep the gateway and Ollama loopback-only", () => {
  assert.match(bootstrap, /-p 127\.0\.0\.1:11434:11434/);
  assert.doesNotMatch(bootstrap, /-p 0\.0\.0\.0:18789/);
  assert.doesNotMatch(bootstrap, /-p 0\.0\.0\.0:11434/);
  assert.doesNotMatch(verify, /gateway\.bind=lan/);
});

test("OCI OpenClaw backup helper is verified and retention-bounded", () => {
  const backup = fs.readFileSync("scripts/oci-openclaw-backup.sh", "utf8");
  assert.match(backup, /openclaw_n\(\)\{ command openclaw "\$@" <\/dev\/null; \}/);
  assert.match(backup, /backup create --output/);
  assert.match(backup, /--verify/);
  assert.match(backup, /OPENCLAW_BACKUP=PASS/);
  assert.match(backup, /RETENTION_DAYS/);
  assert.doesNotMatch(backup, /rm -rf/);
});

test("OCI OpenClaw bootstrap installs and schedules the verified backup", () => {
  assert.match(bootstrap, /oci-openclaw-backup\.sh/);
  assert.match(bootstrap, /Grasshopper\/main\/scripts\/oci-openclaw-backup\.sh/);
  assert.doesNotMatch(bootstrap, /feat\/oci-openclaw-backup-recovery/);
  assert.match(bootstrap, /grasshopper-openclaw-backup\.service/);
  assert.match(bootstrap, /grasshopper-openclaw-backup\.timer/);
  assert.match(bootstrap, /OnUnitActiveSec=24h/);
  assert.match(bootstrap, /Persistent=true/);
  assert.match(bootstrap, /grasshopper-openclaw-backup/);
});

test("OCI OpenClaw verifier requires a recent backup and timer", () => {
  assert.match(verify, /openclaw\.backup\.helper/);
  assert.match(verify, /openclaw\.backup\.timer\.enabled/);
  assert.match(verify, /openclaw\.backup\.timer\.active/);
  assert.match(verify, /openclaw\.backup\.recent/);
  assert.match(verify, /-mmin -1560/);
});
