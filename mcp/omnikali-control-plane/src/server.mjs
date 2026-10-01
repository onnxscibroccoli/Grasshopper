import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { authorize } from './policy.mjs';
import { askModel } from './providers.mjs';
import { startHttpMcp } from './transport.mjs';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';

const ROOT = process.env.OMNIKALI_ROOT || process.cwd();
const BROCCOLI_ROOT = process.env.BROCCOLI_ROOT || ROOT;
const TOKEN = process.env.OMNIKALI_MCP_TOKEN;
if (!TOKEN) throw new Error('OMNIKALI_MCP_TOKEN is required');

const result = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value });
const guarded = (name, fn) => async (args, ctx) => {
  authorize(name, { token: ctx?.authInfo?.token || TOKEN, requiredToken: TOKEN, confirmation: args?.confirm === true });
  return result(await fn(args || {}));
};
const run = (command, cwd = ROOT) => new Promise((resolve, reject) => {
  const p = spawn('/bin/sh', ['-lc', command], { cwd });
  let stdout = ''; let stderr = '';
  p.stdout.on('data', d => stdout += d); p.stderr.on('data', d => stderr += d);
  p.on('error', reject); p.on('close', code => resolve({ exitCode: code, stdout, stderr }));
});

const factory = () => {
  const server = new McpServer({ name: 'omnikali-control-plane', version: '0.1.0' });

  server.registerTool('device.identity', { title: 'Device identity', description: 'Return the orchestrator host identity and execution boundary.', inputSchema: z.object({}) }, guarded('device.identity', async () => ({ host: process.env.HOSTNAME || 'unknown', platform: process.platform, arch: process.arch, root: ROOT, broccoliRoot: BROCCOLI_ROOT })));
  server.registerTool('device.list', { title: 'List devices', description: 'Discover configured execution devices.', inputSchema: z.object({}) }, guarded('device.list', async () => ({ devices: [{ id: 'local', status: 'online', adapter: 'host' }, { id: 'android-rish', status: 'available', adapter: 'broccoli-rish' }] })));
  server.registerTool('fs.read', { title: 'Read file', description: 'Read a UTF-8 file under the configured root.', inputSchema: z.object({ path: z.string() }) }, guarded('fs.read', async ({ path }) => ({ path, content: await fs.readFile(`${ROOT}/${path}`, 'utf8') })));
  server.registerTool('fs.list', { title: 'List directory', description: 'List a directory under the configured root.', inputSchema: z.object({ path: z.string().default('.') }) }, guarded('fs.list', async ({ path }) => ({ path, entries: await fs.readdir(`${ROOT}/${path}`, { withFileTypes: true }).then(xs => xs.map(x => ({ name: x.name, type: x.isDirectory() ? 'directory' : 'file' }))) })));
  server.registerTool('fs.write', { title: 'Write file', description: 'Write a UTF-8 file under the configured root. Requires confirmation.', inputSchema: z.object({ path: z.string(), content: z.string(), confirm: z.boolean().default(false) }) }, guarded('fs.write', async ({ path, content }) => { await fs.writeFile(`${ROOT}/${path}`, content, 'utf8'); return { path, bytes: Buffer.byteLength(content) }; }));
  server.registerTool('fs.search', { title: 'Search files', description: 'Search text under the configured root.', inputSchema: z.object({ pattern: z.string(), path: z.string().default('.') }) }, guarded('fs.search', async ({ pattern, path }) => run(`grep -RIn --exclude-dir=.git -- ${JSON.stringify(pattern)} ${JSON.stringify(path)}`, ROOT)));
  server.registerTool('fs.move', { title: 'Move file', description: 'Move a file under the configured root. Requires confirmation.', inputSchema: z.object({ from: z.string(), to: z.string(), confirm: z.boolean().default(false) }) }, guarded('fs.move', async ({ from, to }) => { await fs.rename(`${ROOT}/${from}`, `${ROOT}/${to}`); return { from, to }; }));
  server.registerTool('process.list', { title: 'List processes', description: 'List processes visible to the orchestrator host.', inputSchema: z.object({}) }, guarded('process.list', async () => run('ps -ef')));
  server.registerTool('process.exec', { title: 'Execute command', description: 'Execute a command on the orchestrator host. Requires explicit confirmation.', inputSchema: z.object({ command: z.string(), confirm: z.boolean().default(false) }) }, guarded('process.exec', async ({ command }) => run(command)));
  server.registerTool('process.kill', { title: 'Kill process', description: 'Terminate a host process. Requires explicit confirmation.', inputSchema: z.object({ pid: z.number().int().positive(), confirm: z.boolean().default(false) }) }, guarded('process.kill', async ({ pid }) => run(`kill ${pid}`)));
  server.registerTool('android.rish', { title: 'Run Android Rish', description: 'Invoke the known-good Broccoli Rish wrapper. Payload must be POSIX sh compatible.', inputSchema: z.object({ command: z.string() }) }, guarded('android.rish', async ({ command }) => run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(command)}`, BROCCOLI_ROOT)));
  server.registerTool('android.input', { title: 'Android input', description: 'Perform a bounded Android input action through Rish. Requires confirmation.', inputSchema: z.object({ action: z.enum(['tap','swipe','text','keyevent']), args: z.array(z.string()).max(8), confirm: z.boolean().default(false) }) }, guarded('android.input', async ({ action, args }) => run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(['input', action, ...args].join(' '))}`, BROCCOLI_ROOT)));
  server.registerTool('android.screenshot', { title: 'Android screenshot', description: 'Capture a screenshot on the Android target to shared storage.', inputSchema: z.object({ path: z.string().default('/storage/emulated/0/Download/OmniKali/mcp-screen.png') }) }, guarded('android.screenshot', async ({ path }) => run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(`screencap -p ${path}`)}`, BROCCOLI_ROOT)));
  server.registerTool('app.inspect', { title: 'Inspect APK', description: 'Run the existing Broccoli application inspector against a local APK path.', inputSchema: z.object({ apkPath: z.string() }) }, guarded('app.inspect', async ({ apkPath }) => run(`python3 tools/apk_inspector.py ${JSON.stringify(apkPath)}`, BROCCOLI_ROOT)));
  server.registerTool('app.launch', { title: 'Launch Android app', description: 'Launch an Android package/activity through Rish. Requires confirmation.', inputSchema: z.object({ packageName: z.string().regex(/^[A-Za-z0-9_.]+$/), activity: z.string().regex(/^[A-Za-z0-9_.$]+$/).optional(), confirm: z.boolean().default(false) }) }, guarded('app.launch', async ({ packageName, activity }) => run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(activity ? `am start -n ${packageName}/${activity}` : `monkey -p ${packageName} 1`)}`, BROCCOLI_ROOT)));
  server.registerTool('app.stop', { title: 'Stop Android app', description: 'Stop an Android package through Rish. Requires confirmation.', inputSchema: z.object({ packageName: z.string().regex(/^[A-Za-z0-9_.]+$/), confirm: z.boolean().default(false) }) }, guarded('app.stop', async ({ packageName }) => run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(`am force-stop ${packageName}`)}`, BROCCOLI_ROOT)));
  server.registerTool('model.status', { title: 'Model provider status', description: 'Show which model API credentials are configured without revealing secrets.', inputSchema: z.object({}) }, guarded('model.status', async () => ({ openai: Boolean(process.env.OPENAI_API_KEY), gemini: Boolean(process.env.GEMINI_API_KEY), grok: Boolean(process.env.XAI_API_KEY) })));
  server.registerTool('model.ask', { title: 'Ask model', description: 'Call OpenAI, Gemini, or Grok through their official APIs using server-side credentials.', inputSchema: z.object({ provider: z.enum(['openai','gemini','grok']), prompt: z.string(), model: z.string().optional() }) }, guarded('model.ask', async ({ provider, prompt, model }) => askModel(provider, prompt, model)));
  server.registerTool('human.status', { title: 'Human boundary status', description: 'Represent a paused task awaiting explicit user action.', inputSchema: z.object({ status: z.enum(['HUMAN_REQUIRED','PAUSED','RESUMABLE']), reason: z.string(), checkpoint: z.record(z.string(), z.any()).optional() }) }, guarded('human.status', async ({ status, reason, checkpoint }) => ({ status, reason, checkpoint: checkpoint || null })));

  return server;
};

startHttpMcp(factory, { port: Number(process.env.PORT || 8787), host: process.env.HOST || '127.0.0.1', token: TOKEN });
console.log(JSON.stringify({ service: 'omnikali-control-plane', transport: 'streamable-http', endpoint: '/mcp', toolCount: 19 }));
