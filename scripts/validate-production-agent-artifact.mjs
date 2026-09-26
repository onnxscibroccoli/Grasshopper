#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const artifact = join(root, "reference/production/deployed/omni-agent.mjs");
const expectedSha = "ffd3d5981cb8cc749cb112d312018b119c95e5613376f1695c59e226aed9b349";
const expectedSize = 4223;

const body = await readFile(artifact);
const sha = createHash("sha256").update(body).digest("hex");
const st = await stat(artifact);

if (sha !== expectedSha) throw new Error(`production agent artifact SHA mismatch: expected ${expectedSha}, got ${sha}`);
if (st.size !== expectedSize) throw new Error(`production agent artifact size mismatch: expected ${expectedSize}, got ${st.size}`);

const text = body.toString("utf8");
const forbidden = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /ASIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AGENT_TOKEN=[^\s"'\\]+/
];

for (const pattern of forbidden) {
  if (pattern.test(text)) throw new Error(`forbidden credential material detected by ${pattern}`);
}

if (text.includes("process.env.AGENT_TOKEN")) throw new Error("agent bridge still references runtime AGENT_TOKEN configuration");
if (!text.includes("loadAgentBridgeToken")) throw new Error("agent bridge does not use the Secrets Manager loader");
if (!text.includes("qemu-agent-command")) throw new Error("agent bridge execution boundary no longer uses qemu-agent-command");
if (!text.includes("guest-exec-status")) throw new Error("agent bridge no longer polls guest-exec-status");

console.log(JSON.stringify({
  artifact: "reference/production/deployed/omni-agent.mjs",
  sha256: sha,
  sizeBytes: st.size,
  credentialScan: "passed",
  executionBoundary: "qemu-agent-command/guest-exec/guest-exec-status",
  secretBoundary: "aws-secrets-manager"
}, null, 2));
