import { createServer } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';

export function startHttpMcp(factory, { port = 8787, host = '127.0.0.1', token } = {}) {
  const handler = createMcpHandler(factory, { legacy: 'stateless' });
  const server = createServer(async (req, res) => {
    try {
      if (req.url !== '/mcp') { res.writeHead(404); res.end('not found'); return; }
      if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(401); res.end('unauthorized'); return; }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      const url = `http://${req.headers.host || `${host}:${port}`}${req.url}`;
      const request = new Request(url, { method: req.method, headers: req.headers, body: body.length ? body : undefined });
      const response = await handler.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
      }
      res.end();
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(error instanceof Error ? error.message : String(error));
    }
  });
  server.listen(port, host);
  return { server, handler };
}
