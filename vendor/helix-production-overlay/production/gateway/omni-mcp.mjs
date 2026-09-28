[Reading 363 lines from start (total: 363 lines, 0 remaining)]

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { createMcpHandler } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { createMcpOAuth } from "./omni-mcp-oauth.mjs";

const execFileAsync = promisify(execFile);
const HOST = process.env.MCP_HOST || "127.0.0.1";
const PORT = Number(process.env.MCP_PORT || 8094);
const VM = process.env.MCP_VM || "helix-omnikali";
const TOKEN = process.env.MCP_AUTH_TOKEN || "";
const PUBLIC_ORIGIN = process.env.HELIX_PUBLIC_ORIGIN || "https://d22bad48irrbqe.cloudfront.net";
const STATE_DIR = process.env.MCP_STATE_DIR || "/var/lib/omnikali/mcp";
const LEDGER = STATE_DIR + "/ledger.json";
const MAX_OUTPUT = 120000;

if (!TOKEN) throw new Error("MCP_AUTH_TOKEN is required");
mkdirSync(STATE_DIR, { recursive: true });

const state = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { tasks: {}, locks: {} };
const oauth = createMcpOAuth();
const save = () => writeFileSync(LEDGER, JSON.stringify(state, null, 2), { mode: 0o600 });

function result(value, isError = false) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    ...(isError ? { isError: true } : {})
  };
}

function lockKey(kind, name = "default") { return `${kind}:${name}`; }

function acquire(key, owner, ttl = 300000) {
  const now = Date.now();
  const current = state.locks[key];
  if (current && current.expiresAt > now && current.owner !== owner)
    return { ok: false, current };
  state.locks[key] = { owner, acquiredAt: now, expiresAt: now + ttl };
  save();
  return { ok: true };
}

function release(key, owner) {
  const current = state.locks[key];
  if (!current || current.owner === owner) {
    delete state.locks[key];
    save();
    return true;
  }
  return false;
}

async function qga(payload, timeout = 15000) {
  const { stdout } = await execFileAsync(
    "/usr/bin/virsh",
    ["-c", "qemu:///system", "qemu-agent-command", VM, JSON.stringify(payload)],
    { timeout, maxBuffer: 2 * 1024 * 1024 }
  );
  return JSON.parse(stdout).return;
}

async function guestExec(command, cwd = "/root", timeout = 900) {
  const started = await qga({
    execute: "guest-exec",
    arguments: {
      path: "/bin/sh",
      arg: ["-lc", `cd -- ${JSON.stringify(cwd)} && ${command}`],
      "capture-output": true
    }
  });
  const pid = started.pid;
  const deadline = Date.now() + timeout * 1000;
  while (Date.now() < deadline) {
    const status = await qga({ execute: "guest-exec-status", arguments: { pid } });
    if (status.exited) {
      return {
        pid,
        exitCode: status.exitcode ?? null,
        signal: status.signal ?? null,
        stdout: Buffer.from(status["out-data"] || "", "base64").toString().slice(-MAX_OUTPUT),
        stderr: Buffer.from(status["err-data"] || "", "base64").toString().slice(-MAX_OUTPUT)
      };
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return { pid, timedOut: true };
}

async function tmux(command, args = []) {
  return guestExec(`tmux ${args.map(a => JSON.stringify(a)).join(" ")}`, "/root", 20);
}

async function ensureSession(session) {
  const r = await guestExec(`tmux has-session -t ${JSON.stringify(session)} 2>/dev/null || tmux new-session -d -s ${JSON.stringify(session)}`);
  return r;
}

async function screenshot() {
  const r = await guestExec(
    "mkdir -p /tmp/omnikali-mcp; if command -v gnome-screenshot >/dev/null 2>&1; then DISPLAY=:99 gnome-screenshot -f /tmp/omnikali-mcp/screen.png; elif command -v import >/dev/null 2>&1; then DISPLAY=:99 import -window root /tmp/omnikali-mcp/screen.png; elif command -v scrot >/dev/null 2>&1; then DISPLAY=:99 scrot /tmp/omnikali-mcp/screen.png; else exit 127; fi; base64 -w0 /tmp/omnikali-mcp/screen.png",
    "/root", 30
  );
  if (r.exitCode !== 0 || !r.stdout) throw new Error(r.stderr || "desktop screenshot unavailable");
  return r.stdout.trim();
}

async function metrics() {
  const [fs, net, sys] = await Promise.all([
    qga({ execute: "guest-get-fsinfo" }),
    qga({ execute: "guest-network-get-interfaces" }),
    guestExec("cat /proc/loadavg; echo '---MEM---'; cat /proc/meminfo | head -8; echo '---UP---'; uptime -p; echo '---PORTS---'; ss -lntup 2>/dev/null | head -80", "/root", 15)
  ]);
  return { filesystem: fs, interfaces: net, system: sys };
}

const server = new McpServer({
  name: "omnikali-control-plane",
  version: "1.0.0",
  description: "OmniKali MCP control plane for the persistent Kali workstation. Provides authenticated execution, asynchronous tmux tasks, machine state resources, desktop observation, and concurrency locks."
});

server.registerTool("run_command", {
  title: "Run command",
  description: "Start a shell command asynchronously inside a persistent tmux session on the Kali VM. Returns a task ID immediately. Commands execute as root inside the VM.",
  inputSchema: z.object({
    command: z.string().min(1),
    cwd: z.string().default("/root"),
    session: z.string().regex(/^[A-Za-z0-9_.-]{1,48}$/).default("omni"),
    interface: z.enum(["shell", "gui"]).default("shell"),
    timeout: z.number().int().min(1).max(86400).default(3600)
  }),
  annotations: { destructiveHint: true, openWorldHint: true }
}, async ({ command, cwd, session, interface: iface, timeout }) => {
  const owner = randomUUID();
  const key = lockKey(iface === "gui" ? "GUI_LOCK" : "PANE_LOCK", session);
  const got = acquire(key, owner, Math.min(timeout * 1000 + 60000, 86400000));
  if (!got.ok) return result({ error: "locked", status: 423, lock: got.current }, true);
  try {
    await ensureSession(session);
    const taskId = randomUUID();
    state.tasks[taskId] = {
      id: taskId, session, cwd, command, interface: iface, owner,
      startedAt: new Date().toISOString(), status: "running"
    };
    save();
    const send = `cd -- ${JSON.stringify(cwd)} && printf '\\n[OMNIKALI TASK ${taskId}]\\n' && ${command}; rc=$?; printf '\\n[OMNIKALI EXIT ${taskId}] %s\\n' "$rc"`;
    const launched = await guestExec(`tmux send-keys -t ${JSON.stringify(session)} -l -- ${JSON.stringify(send)} && tmux send-keys -t ${JSON.stringify(session)} Enter`, "/root", 20);
    if (launched.exitCode !== 0) {
      state.tasks[taskId].status = "failed";
      state.tasks[taskId].error = launched.stderr;
      release(key, owner);
      save();
      return result(state.tasks[taskId], true);
    }
    return result({ taskId, session, status: "running", lock: key });
  } catch (e) {
    release(key, owner);
    return result({ error: e.message }, true);
  }
});

server.registerTool("task_read", {
  title: "Read task output",
  description: "Read persistent tmux scrollback for a task/session. Use repeatedly for long-running commands.",
  inputSchema: z.object({
    taskId: z.string().min(1).max(64).optional(),
    session: z.string().regex(/^[A-Za-z0-9_.-]{1,48}$/).default("omni"),
    lines: z.number().int().min(1).max(1000).default(200)
  })
}, async ({ taskId, session, lines }) => {
  if (taskId && state.tasks[taskId]) session = state.tasks[taskId].session;
  const r = await guestExec(`tmux capture-pane -p -S -${lines} -t ${JSON.stringify(session)} 2>&1`, "/root", 20);
  if (taskId && state.tasks[taskId] && r.stdout.includes(`[OMNIKALI EXIT ${taskId}]`)) {
    const marker = "[OMNIKALI EXIT " + taskId + "]";
    const idx = r.stdout.lastIndexOf(marker);
    const tail = idx >= 0 ? r.stdout.slice(idx + marker.length).trimStart() : "";
    const m = tail.match(/^(\d+)/);
    state.tasks[taskId].status = "completed";
    state.tasks[taskId].exitCode = m ? Number(m[1]) : null;
    state.tasks[taskId].completedAt = state.tasks[taskId].completedAt || new Date().toISOString();
    release(lockKey(state.tasks[taskId].interface === "gui" ? "GUI_LOCK" : "PANE_LOCK", state.tasks[taskId].session), state.tasks[taskId].owner);
    save();
  }
  return result({ taskId: taskId || null, session, status: state.tasks[taskId]?.status || "unknown", output: r.stdout, stderr: r.stderr });
});

server.registerTool("task_stop", {
  title: "Stop task",
  description: "Stop a task by sending Ctrl-C to its tmux session and release its concurrency lock.",
  inputSchema: z.object({ taskId: z.string().min(1).max(64) }),
  annotations: { destructiveHint: true }
}, async ({ taskId }) => {
  const t = state.tasks[taskId];
  if (!t) return result({ error: "task not found" }, true);
  await guestExec(`tmux send-keys -t ${JSON.stringify(t.session)} C-c`, "/root", 10);
  t.status = "stopped";
  t.stoppedAt = new Date().toISOString();
  release(lockKey(t.interface === "gui" ? "GUI_LOCK" : "PANE_LOCK", t.session), t.owner);
  save();
  return result(t);
});

server.registerTool("lock_acquire", {
  title: "Acquire interface lock",
  description: "Acquire an exclusive GUI or named pane lock before a coordinated multi-step operation.",
  inputSchema: z.object({
    interface: z.enum(["GUI_LOCK", "PANE_LOCK"]),
    name: z.string().regex(/^[A-Za-z0-9_.-]{1,48}$/),
    ttlSeconds: z.number().int().min(1).max(86400).default(300)
  })
}, async ({ interface: iface, name, ttlSeconds }) => {
  const owner = randomUUID();
  const got = acquire(lockKey(iface, name), owner, ttlSeconds * 1000);
  return result(got.ok ? { acquired: true, lock: lockKey(iface, name), owner } : { acquired: false, status: 423, lock: got.current }, !got.ok);
});

server.registerTool("lock_release", {
  title: "Release interface lock",
  description: "Release a lock previously acquired by the caller.",
  inputSchema: z.object({ interface: z.enum(["GUI_LOCK", "PANE_LOCK"]), name: z.string(), owner: z.string().min(1).max(64) })
}, async ({ interface: iface, name, owner }) => result({ released: release(lockKey(iface, name), owner) }));

server.registerTool("task_list", {
  title: "List tasks",
  description: "List recent asynchronous tasks and active locks.",
  inputSchema: z.object({})
}, async () => result({ tasks: Object.values(state.tasks).slice(-100), locks: state.locks }));

server.registerTool("system_metrics", {
  title: "System metrics",
  description: "Read structured filesystem and network state plus Linux memory/load/listening-port telemetry.",
  inputSchema: z.object({})
}, async () => result(await metrics()));

server.registerTool("gui_click", {
  title: "GUI click",
  description: "Acquire the GUI lock and click the Kali desktop exported through the same X display used by the VNC/noVNC session.",
  inputSchema: z.object({
    x: z.number().int().min(0).max(10000),
    y: z.number().int().min(0).max(10000),
    button: z.enum(["left", "middle", "right"]).default("left")
  }),
  annotations: { destructiveHint: true }
}, async ({ x, y, button }) => {
  const owner = randomUUID();
  const got = acquire(lockKey("GUI_LOCK", "desktop"), owner, 30000);
  if (!got.ok) return result({ error: "locked", status: 423, lock: got.current }, true);
  try {
    const r = await guestExec(`DISPLAY=:99 xdotool mousemove --sync ${x} ${y} click ${button === "left" ? 1 : button === "middle" ? 2 : 3}`, "/root", 10);
    return result({ ok: r.exitCode === 0, x, y, button, stderr: r.stderr });
  } finally {
    release(lockKey("GUI_LOCK", "desktop"), owner);
  }
});

server.registerTool("gui_type", {
  title: "GUI type",
  description: "Acquire the GUI lock and type text into the active Kali desktop window.",
  inputSchema: z.object({
    text: z.string().min(1).max(10000),
    intervalMs: z.number().int().min(0).max(1000).default(1)
  }),
  annotations: { destructiveHint: true }
}, async ({ text, intervalMs }) => {
  const owner = randomUUID();
  const got = acquire(lockKey("GUI_LOCK", "desktop"), owner, 30000);
  if (!got.ok) return result({ error: "locked", status: 423, lock: got.current }, true);
  try {
    const r = await guestExec(`DISPLAY=:99 xdotool type --delay ${intervalMs} -- ${JSON.stringify(text)}`, "/root", 30);
    return result({ ok: r.exitCode === 0, stderr: r.stderr });
  } finally {
    release(lockKey("GUI_LOCK", "desktop"), owner);
  }
});

server.registerResource("tmux-buffer", new ResourceTemplate("vm://tmux/buffer/{session}", { list: undefined }), {
  title: "Terminal scrollback",
  description: "Last terminal lines from a persistent OmniKali tmux session.",
  mimeType: "text/plain"
}, async (uri, { session }) => {
  const r = await guestExec(`tmux capture-pane -p -S -200 -t ${JSON.stringify(session)} 2>&1`, "/root", 20);
  return { contents: [{ uri: uri.href, mimeType: "text/plain", text: r.stdout }] };
});

server.registerResource("desktop-screenshot", "vm://desktop/screenshot", {
  title: "Kali desktop screenshot",
  description: "Current visual frame of the Kali desktop.",
  mimeType: "image/png"
}, async uri => ({ contents: [{ uri: uri.href, mimeType: "image/png", blob: await screenshot() }] }));

server.registerResource("system-metrics", "vm://metrics/sysinfo", {
  title: "System telemetry",
  description: "Current filesystem, interface, load, memory and listening-port state.",
  mimeType: "application/json"
}, async uri => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await metrics()) }] }));

server.registerResource("task-ledger", "vm://ledger/tasks", {
  title: "Concurrency and task ledger",
  description: "Persistent task and interface-lock state for multi-agent coordination.",
  mimeType: "application/json"
}, async uri => ({ contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(state) }] }));

const handler = createMcpHandler(() => server, { legacy: "stateless" });

function authorized(req) {
  const h = req.headers.authorization || "";
  return h === `Bearer ${TOKEN}` || Boolean(oauth.authorize(req));
}

const http = createServer(async (req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, service: "omnikali-mcp", vm: VM, protocol: "2026-07-28" }));
  }
  const u = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (oauth.isOAuthPath(u.pathname)) {
    const handled = await oauth.handle(req, res, u);
    if (handled !== false) return handled;
  }
  if (u.pathname === "/mcp" || u.pathname.startsWith("/mcp/")) {
    console.error(`[omnikali-mcp] MCP_REQUEST method=${req.method} path=${u.pathname} accept=${JSON.stringify(req.headers.accept || "")} contentType=${JSON.stringify(req.headers["content-type"] || "")} auth=${req.headers.authorization ? "present" : "absent"}`);
    if (!authorized(req)) {
      res.writeHead(401, { "www-authenticate": `Bearer resource_metadata="${PUBLIC_ORIGIN}/.well-known/oauth-protected-resource"` });
      return res.end(JSON.stringify({ error: "unauthorized" }));
    }
    return handleMcpHttp(req, res);
  }
  res.writeHead(404);
  res.end();
});

http.listen(PORT, HOST, () => console.error(`[omnikali-mcp] ${HOST}:${PORT}`));

async function handleMcpHttp(req, res) {
  const headers = new Headers(req.headers);
  // Gemini's Connected Apps proxy may omit text/event-stream from Accept even
  // though it expects the standard Streamable HTTP JSON response. Normalize the
  // compatibility request at our edge rather than returning SDK 406.
  if ((req.method || "").toUpperCase() === "POST" && req.url?.startsWith("/mcp")) {
    const accept = headers.get("accept") || "";
    if (!accept.includes("application/json")) headers.set("accept", "application/json");
    if (!accept.includes("text/event-stream")) headers.set("accept", `${headers.get("accept")}, text/event-stream`);
  }
  const hasBody = !["GET", "HEAD"].includes((req.method || "GET").toUpperCase());
  const init = { method: req.method, headers };
  if (hasBody) {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }
  const host = req.headers.host || "127.0.0.1:8094";
  const request = new Request(`https://${host}${req.url || "/mcp"}`, init);
  const response = await handler.fetch(request);
  const outHeaders = {};
  response.headers.forEach((value, key) => { outHeaders[key] = value; });
  res.writeHead(response.status, outHeaders);
  if (!response.body) return res.end();
  Readable.fromWeb(response.body).pipe(res);
}

[executed on device: ip-172-31-8-59 (882f1036-235b-4669-acaf-1e1135b156bd)]