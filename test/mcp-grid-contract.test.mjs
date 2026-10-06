import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const doc = fs.readFileSync("docs/architecture/mcp-grid.md", "utf8");
const server = fs.readFileSync("scripts/mcp-grid/server.mjs", "utf8");

test("MCP grid remains decoupled from Cloud Android ADB recovery", () => {
  assert.match(doc, /R2 ADB remains BROKEN_NEEDS_REIMPLEMENTATION/);
  assert.match(doc, /R3 Rish remains NOT_PROVEN/);
  assert.match(server, /No fallback transport is attempted/);
});

test("prototype is local-only and fail-closed", () => {
  assert.match(server, /StdioServerTransport/);
  assert.match(server, /network_listener: false/);
  assert.match(server, /No system executor is registered/);
  assert.doesNotMatch(server, /execSync|spawn\(|child_process|shell: true/);
});

test("remote security boundary is explicit", () => {
  assert.match(doc, /OAuth2\/OIDC/);
  assert.match(doc, /mTLS/);
  assert.match(doc, /Streamable HTTP/);
  assert.match(doc, /HTTP\+SSE is compatibility-only/);
  assert.match(doc, /No production MCP endpoint is promoted/);
});
