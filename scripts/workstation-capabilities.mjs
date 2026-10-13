import { spawnSync } from 'node:child_process';
import { readdirSync, existsSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
export function classifyProbe(result) {
  if (result.error?.code === 'ENOENT') return 'unavailable';
  if (result.error || result.signal) return 'probe_failed';
  if (result.status !== 0) return 'probe_failed';
  return String(result.stdout || '').trim() ? 'available' : 'not_proven';
}
export function recommendation(capabilities) {
  const browser = capabilities.find(c => c.name === 'browser.dom');
  return browser?.status === 'verified'
    ? { action: 'use_verified_browser', replayObservedEvents: false }
    : { action: 'repair_browser_dependency_then_reprobe', replayObservedEvents: false };
}
export async function discover() {
  const home = homedir();
  const path = [join(home,'.local/bin'), join(home,'.opencode/bin'), join(home,'.openclaw/bin'), process.env.PATH || ''].join(':');
  const capabilities = ['node','python3','git','gh','podman','firefox','claude','opencode','openclaw','aws','oci','rclone'].map(name => {
    const result = spawnSync(name, ['--version'], { env: {...process.env, PATH:path}, encoding:'utf8', timeout:10000, maxBuffer:65536 });
    return { name, status:classifyProbe(result), evidence:String(result.stdout || '').trim().split('\n')[0].slice(0,160), authenticated:'not_proven' };
  });
  let puppeteer;
  try { puppeteer = require('puppeteer'); } catch {
    const cache = join(home,'.npm/_npx');
    if (existsSync(cache)) for (const dir of readdirSync(cache).sort()) {
      try { puppeteer = require(join(cache,dir,'node_modules/puppeteer')); break; } catch {}
    }
  }
  const candidates = [];
  for (const [cache,suffix] of [[join(home,'.cache/puppeteer/chrome'),'chrome-linux-arm64/chrome'],[join(home,'.cache/ms-playwright'),'chrome-linux-arm64/chrome']]) {
    if (existsSync(cache)) for (const dir of readdirSync(cache).sort().reverse()) {
      const executable = join(cache,dir,suffix); if (existsSync(executable)) candidates.push(executable);
    }
  }
  if (process.env.GRASSHOPPER_BROWSER_EXECUTABLE) candidates.unshift(process.env.GRASSHOPPER_BROWSER_EXECUTABLE);
  const attempts = [];
  if (puppeteer) for (const executablePath of candidates) {
    let browser;
    try {
      browser = await puppeteer.launch({executablePath, headless:true, timeout:15000});
      const page = await browser.newPage(); page.setDefaultTimeout(5000);
      await page.setContent('<button aria-label="Probe">Run</button><output></output><script>document.querySelector("button").onclick=()=>document.querySelector("output").textContent="GRASSHOPPER_DOM_OK";</script>');
      await page.click('button');
      const marker = await page.$eval('output', n=>n.textContent);
      if (marker !== 'GRASSHOPPER_DOM_OK') throw new Error('artifact_missing');
      capabilities.push({name:'browser.dom',status:'verified',evidence:marker,version:await browser.version(),executablePath}); break;
    } catch (error) { attempts.push({executablePath,status:'probe_failed',failureClass:error.name}); }
    finally { if (browser) await browser.close(); }
  }
  if (!capabilities.some(c=>c.name==='browser.dom')) capabilities.push({name:'browser.dom',status:'not_proven',failureClass:!puppeteer?'module_unavailable':!candidates.length?'executable_unavailable':'launch_or_dom_failure'});
  return {schemaVersion:1,observedAt:new Date().toISOString(),capabilities,attempts,next:recommendation(capabilities)};
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const report = await discover();
  const target = process.argv[2];
  if (target) { mkdirSync(dirname(target),{recursive:true}); const tmp=target+'.'+process.pid+'.tmp'; writeFileSync(tmp,JSON.stringify(report,null,2)+'\n',{mode:0o600}); renameSync(tmp,target); }
  console.log(JSON.stringify(report,null,2));
}
