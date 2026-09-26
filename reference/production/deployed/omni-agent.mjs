import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);
const HOST = process.env.AGENT_HOST || "127.0.0.1";
const PORT = Number(process.env.AGENT_PORT || 8093);
const TOKEN = process.env.AGENT_TOKEN || "";
const VM = process.env.AGENT_VM || "helix-omnikali";
const MAX_BODY = 1024 * 1024;
if (!TOKEN) throw new Error("AGENT_TOKEN is required");

function json(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        req.destroy();
        reject(new Error("request too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
      catch { reject(new Error("invalid JSON")); }
    });
    req.on("error", reject);
  });
}function authorized(req) {
  const h = req.headers.authorization || "";
  return h === `Bearer ${TOKEN}`;
}

async function guestExec(command, cwd = "/root", timeout = 300) {
  const payload = JSON.stringify({
    execute: "guest-exec",
    arguments: {
      path: "/bin/sh",
      arg: ["-lc", `cd -- ${JSON.stringify(cwd)} && ${command}`],
      "capture-output": true
    }
  });
  const { stdout } = await execFileAsync(
    "/usr/bin/virsh",
    ["-c", "qemu:///system", "qemu-agent-command", VM, payload],
    { timeout: 15000, maxBuffer: 2 * 1024 * 1024 }
  );
  const pid = JSON.parse(stdout).return.pid;
  const deadline = Date.now() + timeout * 1000;
  while (Date.now() < deadline) {
    const statusPayload = JSON.stringify({
      execute: "guest-exec-status",
      arguments: { pid }
    });
    const { stdout: statusOut } = await execFileAsync(
      "/usr/bin/virsh",
      ["-c", "qemu:///system", "qemu-agent-command", VM, statusPayload],
      { timeout: 15000, maxBuffer: 2 * 1024 * 1024 }
    );    const status = JSON.parse(statusOut).return;
    if (status.exited) {
      return {
        exitCode: status.exitcode ?? null,
        signal: status.signal ?? null,
        stdout: Buffer.from(status["out-data"] || "", "base64").toString(),
        stderr: Buffer.from(status["err-data"] || "", "base64").toString()
      };
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("guest command timeout");
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    if (req.method === "GET" && url.pathname === "/health")
      return json(res, 200, { ok: true, service: "omni-agent", vm: VM });
    if (req.method !== "POST" || url.pathname !== "/execute")
      return json(res, 404, { error: "not found" });
    if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
    const body = await readBody(req);
    const command = String(body.command || "");
    const cwd = String(body.cwd || "/root");
    const timeout = Math.min(Math.max(Number(body.timeout || 300), 1), 900);    if (!command.trim()) return json(res, 400, { error: "command is required" });
    if (!cwd.startsWith("/") || cwd.includes("\0"))
      return json(res, 400, { error: "invalid cwd" });
    const id = randomUUID();
    console.log(JSON.stringify({ event: "execute", id, command, cwd, timeout }));
    const result = await guestExec(command, cwd, timeout);
    console.log(JSON.stringify({ event: "complete", id, exitCode: result.exitCode }));
    return json(res, 200, { id, vm: VM, ...result });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e?.message || "agent error" });
  }
});

server.listen(PORT, HOST, () => console.log(`[omni-agent] ${HOST}:${PORT} vm=${VM}`));