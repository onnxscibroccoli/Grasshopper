import test from "node:test";
import assert from "node:assert/strict";
import { loadAgentBridgeToken } from "../src/production/agent-secret.mjs";

test("loads the agent token through Secrets Manager without environment token injection", async () => {
  const calls = [];
  const token = await loadAgentBridgeToken({
    secretId: "omnikali/production/agent-bridge-token",
    region: "us-east-1",
    execFileImpl: async (...args) => {
      calls.push(args);
      return { stdout: "test-token\n", stderr: "" };
    }
  });
  assert.equal(token, "test-token");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][0], "/usr/bin/aws");
  assert.equal(calls[0][1][0], "secretsmanager");
  assert.equal(calls[0][1][1], "get-secret-value");
  assert.ok(!JSON.stringify(calls).includes("AGENT_TOKEN="));
});
