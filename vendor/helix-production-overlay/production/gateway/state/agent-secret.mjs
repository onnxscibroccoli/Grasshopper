[Reading 28 lines from start (total: 28 lines, 0 remaining)]

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
let cachedTokenPromise;

export async function loadAgentBridgeToken({
  secretId = process.env.HELIX_AGENT_TOKEN_SECRET_ID,
  region = process.env.AWS_REGION || "us-east-1",
  execFileImpl = execFileAsync
} = {}) {
  if (!secretId) throw new Error("HELIX_AGENT_TOKEN_SECRET_ID is required");
  if (!cachedTokenPromise) {
    cachedTokenPromise = execFileImpl(
      "/usr/bin/aws",
      ["secretsmanager", "get-secret-value", "--region", region, "--secret-id", secretId, "--query", "SecretString", "--output", "text"],
      { maxBuffer: 128 * 1024 }
    ).then(({ stdout }) => {
      const token = String(stdout || "").trim();
      if (!token) throw new Error("agent bridge secret is empty");
      return token;
    }).catch(error => {
      cachedTokenPromise = undefined;
      throw new Error(`agent bridge secret unavailable: ${error?.message || error}`);
    });
  }
  return cachedTokenPromise;
}

[executed on device: ip-172-31-8-59 (882f1036-235b-4669-acaf-1e1135b156bd)]