import test from "node:test";
import assert from "node:assert/strict";
import { listGitHubEvidenceTools, callGitHubEvidenceTool } from "../src/mcp/github-evidence-tools.mjs";

test("GitHub evidence MCP facade exposes one read-only search tool", () => {
  const tools = listGitHubEvidenceTools();
  assert.equal(tools.length, 1);
  assert.equal(tools[0].name, "omnikali_search_github_evidence");
  assert.deepEqual(tools[0].inputSchema.required, ["query"]);
});

test("GitHub evidence MCP facade rejects unknown and invalid calls", async () => {
  assert.deepEqual(
    await callGitHubEvidenceTool("unknown", { query: "chat" }),
    { accepted: false, reason: "unknown_tool" }
  );
  assert.deepEqual(
    await callGitHubEvidenceTool("omnikali_search_github_evidence", { query: "" }),
    { accepted: false, reason: "invalid_query" }
  );
  assert.deepEqual(
    await callGitHubEvidenceTool("omnikali_search_github_evidence", { query: "chat", limit: 101 }),
    { accepted: false, reason: "invalid_limit" }
  );
});
