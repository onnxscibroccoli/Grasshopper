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
