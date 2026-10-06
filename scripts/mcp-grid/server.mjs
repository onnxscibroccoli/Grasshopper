#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { randomUUID } from "node:crypto";

const nodeId = process.env.OMNIKALI_NODE_ID || "unregistered-node";
const version = process.env.OMNIKALI_MCP_VERSION || "0.1.0";

const server = new McpServer({
  name: `omnikali-${nodeId}`,
  version
});

function evidence(status, detail, extra = {}) {
  return {
    schema: "omnikali-mcp-evidence/v1",
    status,
    detail,
    node_id: nodeId,
    request_id: randomUUID(),
    ...extra
  };
}

server.tool(
  "node.status",
  "Return node-local MCP capability evidence without mutating the node.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(evidence("PASS_WITH_NOT_PROVEN",
      "MCP stdio control-plane prototype is running; node capabilities are not promoted until individually proven.",
      {
        transport: "stdio",
        network_listener: false,
        capabilities: {
          "node.status": "PASS",
          "gui.capture": "NOT_PROVEN",
          "gui.input": "NOT_PROVEN",
          "gui.tree": "NOT_PROVEN",
          "web.navigate": "NOT_PROVEN",
          "web.evaluate": "NOT_PROVEN",
          "system.exec": "NOT_PROVEN",
          "local.llm": "NOT_PROVEN"
        }
      })) }]
  })
);

server.tool(
  "gui.capture",
  "Capture a node-local framebuffer only after a registered GUI provider is installed.",
  { session_id: { type: "string" }, max_bytes: { type: "number" } },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(evidence("NOT_PROVEN",
      "No GUI provider is registered in the prototype. No fallback transport is attempted.")) }]
  })
);

server.tool(
  "gui.input",
  "Inject typed GUI input through a registered node-local provider.",
  { session_id: { type: "string" }, action: { type: "string" } },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(evidence("NOT_PROVEN",
      "No GUI input provider is registered in the prototype. ADB/Rish are not assumed healthy.")) }]
  })
);

server.tool(
  "system.exec",
  "Execute a typed, policy-approved node operation. Arbitrary shell strings are intentionally unsupported.",
  { operation: { type: "string" } },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(evidence("NOT_PROVEN",
      "No system executor is registered. Arbitrary shell execution is disabled by contract.")) }]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
