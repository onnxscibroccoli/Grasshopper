#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
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

server.registerTool(
  "node.status",
  { description: "Return node-local MCP capability evidence without mutating the node.", inputSchema: z.object({}) },
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

server.registerTool(
  "gui.capture",
  { description: "Capture a node-local framebuffer only after a registered GUI provider is installed.", inputSchema: z.object({ session_id: z.string(), max_bytes: z.number() }) },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(evidence("NOT_PROVEN",
      "No GUI provider is registered in the prototype. No fallback transport is attempted.")) }]
  })
);

server.registerTool(
  "gui.input",
  { description: "Inject typed GUI input through a registered node-local provider.", inputSchema: z.object({ session_id: z.string(), action: z.string() }) },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(evidence("NOT_PROVEN",
      "No GUI input provider is registered in the prototype. ADB/Rish are not assumed healthy.")) }]
  })
);

server.registerTool(
  "system.exec",
  { description: "Execute a typed, policy-approved node operation. Arbitrary shell strings are intentionally unsupported.", inputSchema: z.object({ operation: z.string() }) },
  async () => ({
    content: [{ type: "text", text: JSON.stringify(evidence("NOT_PROVEN",
      "No system executor is registered. Arbitrary shell execution is disabled by contract.")) }]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
