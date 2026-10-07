import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const gateway = fs.readFileSync("scripts/mcp-grid/gateway.mjs", "utf8");
const doc = fs.readFileSync("docs/architecture/mcp-grid.md", "utf8");

test("gateway is authenticated and fail-closed", () => {
  assert.match(gateway, /requireBearerAuth/);
  assert.match(gateway, /OMNIKALI_MCP_DEV_TOKEN/);
  assert.match(gateway, /refusing to start unauthenticated/);
  assert.match(gateway, /requiredScopes: \["mcp:invoke"\]/);
  assert.match(gateway, /expectedResource: resourceUrl/);
});

test("gateway is loopback-only by default and does not execute shell commands", () => {
  assert.match(gateway, /127\.0\.0\.1/);
  assert.doesNotMatch(gateway, /execSync|spawn\(|child_process|shell: true/);
});

test("gateway carries an audit request identity and exposes no production claim", () => {
  assert.match(gateway, /x-omnikali-request-id/);
  assert.match(gateway, /decision: "ALLOW"/);
  assert.match(gateway, /production: false/);
  assert.match(doc, /Authenticated MCP Grid Gateway/);
});
