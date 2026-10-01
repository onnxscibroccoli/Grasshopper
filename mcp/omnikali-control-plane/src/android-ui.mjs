import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function run(command, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn('/bin/bash', ['-lc', command], { cwd });
    let stdout = ''; let stderr = '';
    p.stdout.on('data', d => stdout += d); p.stderr.on('data', d => stderr += d);
    p.on('error', reject); p.on('close', code => resolve({ exitCode: code, stdout, stderr }));
  });
}

function attr(node, key) {
  const m = node.match(new RegExp(`${key}="([^"]*)"`));
  return m ? m[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&') : '';
}

export function parseUiXml(xml) {
  return [...xml.matchAll(/<node\b[^>]*>/g)].map((m, index) => {
    const raw = m[0];
    const bounds = attr(raw, 'bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    const b = bounds ? { x1:+bounds[1], y1:+bounds[2], x2:+bounds[3], y2:+bounds[4], cx:Math.floor((+bounds[1]+ +bounds[3])/2), cy:Math.floor((+bounds[2]+ +bounds[4])/2) } : null;
    return { index, text:attr(raw,'text'), desc:attr(raw,'content-desc'), resourceId:attr(raw,'resource-id'), className:attr(raw,'class'), packageName:attr(raw,'package'), clickable:attr(raw,'clickable') === 'true', enabled:attr(raw,'enabled') !== 'false', bounds:b };
  }).filter(n => n.bounds);
}

export function matchNodes(nodes, selector = {}) {
  return nodes.filter(n => {
    if (selector.text && !n.text.toLowerCase().includes(selector.text.toLowerCase())) return false;
    if (selector.contentDescription && !n.desc.toLowerCase().includes(selector.contentDescription.toLowerCase())) return false;
    if (selector.resourceId && n.resourceId !== selector.resourceId) return false;
    if (selector.className && n.className !== selector.className) return false;
    if (selector.packageName && n.packageName !== selector.packageName) return false;
    if (selector.clickable !== undefined && n.clickable !== selector.clickable) return false;
    return true;
  });
}

export async function snapshot({ broccoliRoot, output = join(tmpdir(), `omnikali-ui-${Date.now()}.xml`) }) {
  const remote = `/data/local/tmp/omnikali-ui-${Date.now()}.xml`;
  const command = `RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(`uiautomator dump --compressed ${remote} >/dev/null 2>&1; cat ${remote}`)}`;
  const r = await run(command, broccoliRoot);
  const start = r.stdout.indexOf('<?xml');
  const xml = start >= 0 ? r.stdout.slice(start) : '';
  if (!xml) throw new Error(`UI_SNAPSHOT_FAILED: ${r.stderr || r.stdout}`);
  await fs.writeFile(output, xml);
  return { output, nodes: parseUiXml(xml), xmlBytes:Buffer.byteLength(xml) };
}

export async function act({ broccoliRoot, action, node, text }) {
  if (!node?.bounds) throw new Error('UI_NODE_BOUNDS_REQUIRED');
  const { cx, cy } = node.bounds;
  let payload;
  if (action === 'tap') payload = `input tap ${cx} ${cy}`;
  else if (action === 'long_press') payload = `input swipe ${cx} ${cy} ${cx} ${cy} 800`;
  else if (action === 'set_text') payload = `input text ${JSON.stringify(text || '')}`;
  else throw new Error('UI_ACTION_NOT_SUPPORTED');
  return run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(payload)}`, broccoliRoot);
}
