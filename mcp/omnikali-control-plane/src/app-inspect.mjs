import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const PACKAGE_RE = /^[A-Za-z0-9_.]+$/;

function run(command, cwd, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const p = spawn('/bin/sh', ['-lc', command], { cwd, detached:true });
    let stdout = ''; let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-p.pid, 'SIGKILL'); } catch { p.kill('SIGKILL'); } }, timeoutMs);
    p.stdout.on('data', d => stdout += d);
    p.stderr.on('data', d => stderr += d);
    p.on('error', reject);
    p.on('close', code => { clearTimeout(timer); if (timedOut) resolve({ exitCode:124, stdout, stderr, timedOut:true }); else resolve({ exitCode: code, stdout, stderr, timedOut:false }); });
  });
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

export async function inspectInstalled({ broccoliRoot, packageName, snapshot }) {
  if (!PACKAGE_RE.test(packageName)) throw new Error('INVALID_ANDROID_PACKAGE');
  const remote = await run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(`pm path ${packageName}`)}`, broccoliRoot);
  if (remote.exitCode !== 0) throw new Error(`APK_PATH_FAILED: ${remote.timedOut ? 'timeout' : (remote.stderr || remote.stdout)}`);
  const apkPath = remote.stdout.split(/\r?\n/).map(line => line.replace(/^package:/, '').trim()).find(Boolean);
  if (!apkPath || !apkPath.startsWith('/') || apkPath.split('/').includes('..') || /[\r\n]/.test(apkPath)) throw new Error('APK_PATH_NOT_FOUND');

  const safeName = packageName.replaceAll('.', '_');
  const sharedDir = '/storage/emulated/0/Download/OmniKali/apks';
  const sharedPath = `${sharedDir}/${safeName}.apk`;
  const copy = await run(
    `RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(`mkdir -p ${sharedDir} && cp ${apkPath} ${sharedPath} && chmod 644 ${sharedPath}`)}`,
    broccoliRoot,
  );
  if (copy.exitCode !== 0) throw new Error(`APK_COPY_FAILED: ${copy.timedOut ? 'timeout' : (copy.stderr || copy.stdout)}`);

  const localCandidates = [sharedPath, `/sdcard/Download/OmniKali/apks/${safeName}.apk`];
  let localPath = null;
  for (const candidate of localCandidates) {
    const check = await run(`test -f ${shellQuote(candidate)} && printf '%s' ${shellQuote(candidate)}`, broccoliRoot);
    if (check.exitCode === 0 && check.stdout) { localPath = check.stdout; break; }
  }
  if (!localPath) {
    return { schema:'omnikali.application.inspect/v1', packageName, remoteApkPath:apkPath, sharedApkPath:sharedPath, status:'APK_COPIED_NOT_VISIBLE_TO_ORCHESTRATOR', evidence:'Rish copied installed APK to shared storage, but the orchestrator cannot read the shared path.' };
  }

  const inspectorPath = process.env.OMNIKALI_APK_INSPECTOR || resolve(dirname(fileURLToPath(import.meta.url)), '../../../tools/apk_inspector.py');
  const cacheDir = resolve(broccoliRoot, '.cache', 'omnikali-apk-intel');
  const cachedApk = resolve(cacheDir, `${safeName}.apk`);
  const stage = await run(`mkdir -p ${shellQuote(cacheDir)} && cp ${shellQuote(localPath)} ${shellQuote(cachedApk)}`, broccoliRoot, 30000);
  if (stage.exitCode !== 0) throw new Error(`APK_STAGE_FAILED: ${stage.timedOut ? 'timeout' : (stage.stderr || stage.stdout)}`);
  const inspect = await run(`python3 ${shellQuote(inspectorPath)} ${shellQuote(cachedApk)}`, broccoliRoot, 90000);
  if (inspect.exitCode !== 0) throw new Error(`APK_INSPECTION_FAILED: ${inspect.timedOut ? 'timeout' : (inspect.stderr || inspect.stdout)}`);
  let staticInspection;
  try { staticInspection = JSON.parse(inspect.stdout); } catch { throw new Error('APK_INSPECTION_JSON_INVALID'); }
  const live = snapshot ? await snapshot() : null;
  return {
    schema:'omnikali.application.inspect/v1',
    packageName,
    remoteApkPath:apkPath,
    localApkPath:localPath,
    stagedApkPath:cachedApk,
    staticInspection,
    liveUi:live,
    layout: {
      staticLayoutCandidates: staticInspection.layout_candidates || [],
      liveNodeCount: live?.nodes?.length || 0,
      livePackages: [...new Set((live?.nodes || []).map(node => node.packageName).filter(Boolean))],
    },
  };
}
