#!/usr/bin/env node
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  McpServer,
  OAuthError,
  OAuthErrorCode,
  createMcpHandler,
  requireBearerAuth
} from "@modelcontextprotocol/server";

const host = process.env.OMNIKALI_MCP_HOST || "127.0.0.1";
const port = Number(process.env.OMNIKALI_MCP_PORT || 8787);
const resourceUrl = new URL(process.env.OMNIKALI_MCP_RESOURCE_URL || `http://${host}:${port}/mcp`);
const devToken = process.env.OMNIKALI_MCP_DEV_TOKEN;
const authMode = process.env.OMNIKALI_MCP_AUTH_MODE || "dev-static";

if (authMode !== "dev-static") {
  throw new Error("Only dev-static auth is implemented in this gateway prototype; refusing an unimplemented production auth mode");
}
if (!devToken || devToken.length < 32) {
  throw new Error("OMNIKALI_MCP_DEV_TOKEN must be set and at least 32 characters; refusing to start unauthenticated");
}

async function verifyAccessToken(token) {
  if (token !== devToken) {
    throw new OAuthError(OAuthErrorCode.InvalidToken, "invalid bearer token");
  }
  return {
    token,
    clientId: "dev-gateway-client",
    scopes: ["mcp:invoke"],
    expiresAt: Math.floor(Date.now() / 1000) + 300,
    resource: resourceUrl
  };
}

const auth = requireBearerAuth({
  verifier: { verifyAccessToken },
  requiredScopes: ["mcp:invoke"],
  expectedResource: resourceUrl
});

function buildServer({ authInfo }) {
  const server = new McpServer(
    { name: "omnikali-mcp-gateway", version: "0.2.0-dev" },
    { capabilities: { tools: {} } }
  );

  server.registerTool(
    "gateway.status",
    {
      description: "Return authenticated gateway evidence without mutating a node.",
      inputSchema: {}
    },
    async () => ({
      content: [{
        type: "text",
        text: JSON.stringify({
          schema: "omnikali-mcp-gateway-evidence/v1",
          status: "PASS_WITH_NOT_PROVEN",
          auth: {
            mode: authMode,
            client_id: authInfo?.clientId,
            scopes: authInfo?.scopes
          },
          transport: "streamable-http",
          production: false,
          node_execution: "NOT_PROVEN"
        })
      }]
    })
  );

  return server;
}

const handler = createMcpHandler(buildServer);

function nodeRequestToWebRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const hostHeader = req.headers.host || `${host}:${port}`;
  const url = new URL(req.url || "/", `${protocol}://${hostHeader}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  const init = { method: req.method, headers, signal: req.signal };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }
  return new Request(url, init);
}

async function sendWebResponse(res, response) {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (!response.body) {
    res.end();
    return;
  }
  for await (const chunk of response.body) res.write(Buffer.from(chunk));
  res.end();
}

const server = createServer(async (req, res) => {
  const requestId = req.headers["x-omnikali-request-id"] || randomUUID();
  res.setHeader("x-omnikali-request-id", requestId);

  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "PASS", auth_mode: authMode, production: false }));
    return;
  }

  if (req.url?.split("?")[0] !== "/mcp") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", request_id: requestId }));
    return;
  }

  try {
    const request = nodeRequestToWebRequest(req);
    const authResult = await auth(request);
    if (authResult instanceof Response) {
      console.error(JSON.stringify({ request_id: requestId, decision: "DENY", reason: "authentication" }));
      await sendWebResponse(res, authResult);
      return;
    }

    console.error(JSON.stringify({
      request_id: requestId,
      decision: "ALLOW",
      client_id: authResult.clientId,
      scopes: authResult.scopes,
      method: req.method,
      path: "/mcp"
    }));

    const response = await handler.fetch(request, { authInfo: authResult });
    await sendWebResponse(res, response);
  } catch (error) {
    console.error(JSON.stringify({ request_id: requestId, decision: "ERROR", error: String(error) }));
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "server_error", request_id: requestId }));
    } else {
      res.end();
    }
  }
});

server.listen(port, host, () => {
  console.error(JSON.stringify({ status: "LISTENING", host, port, resource: resourceUrl.toString(), auth_mode: authMode }));
});
