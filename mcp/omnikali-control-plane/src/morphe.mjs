import { spawn } from 'node:child_process';

const SOURCES = [
  {
    id: 'hoodles',
    upstream: 'hoo-dles/morphe-patches',
    fork: 'onnxscibroccoli/morphe-patches',
    trust: 'VERIFIED_SIGNED_RELEASE_METADATA',
    evidence: 'patches-bundle.json publishes .mpp and .mpp.asc release assets',
    relevantPackages: ['com.adguard.android','com.amazon.avod.thirdpartyclient','com.duolingo'],
  },
  {
    id: 'kareem',
    upstream: 'kareemlukitomo/morphe-patches',
    fork: 'onnxscibroccoli/morphe-patches-1',
    trust: 'VERIFIED_SIGNED_RELEASE_METADATA',
    evidence: 'README documents signed .mpp releases and generated bundle metadata',
    relevantPackages: ['com.instagram.android','com.instagram.barcelona','com.zhiliaoapp.musically','com.reddit.frontpage','com.twitter.android'],
  },
  {
    id: 'alastor',
    upstream: 'Alastor-Kaneki/Morphe-Patches',
    fork: 'onnxscibroccoli/Morphe-Patches-2',
    trust: 'REPO_VERIFIED_BUILDABLE_NOT_SIGNATURE_VERIFIED',
    evidence: 'public repo documents CI-built .mpp artifacts and local tests',
    relevantPackages: ['com.android.chrome','com.opera.gx'],
  },
];

const run = (command, cwd) => new Promise((resolve, reject) => {
  const p = spawn('/bin/sh', ['-lc', command], { cwd });
  let stdout=''; let stderr='';
  p.stdout.on('data', d => stdout += d); p.stderr.on('data', d => stderr += d);
  p.on('error', reject); p.on('close', code => resolve({exitCode:code,stdout,stderr}));
});

export function sourceManifest() {
  return { generatedAt: new Date().toISOString(), policy: 'Only VERIFIED_* sources may be proposed automatically; patch execution remains separately gated.', sources: SOURCES };
}

export function sourceById(id) {
  return SOURCES.find(s => s.id === id) || null;
}

export async function prepareSource({ broccoliRoot, sourceId }) {
  const source = sourceById(sourceId);
  if (!source) throw new Error('MORPHE_SOURCE_NOT_FOUND');
  const url = `https://morphe.software/add-source?github=${encodeURIComponent(source.fork)}`;
  return run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(`am start -a android.intent.action.VIEW -d ${url}`)}`, broccoliRoot);
}

export async function prepareBatch({ broccoliRoot, packages }) {
  if (!Array.isArray(packages) || packages.length === 0 || packages.length > 20) throw new Error('MORPHE_BATCH_PACKAGES_REQUIRED');
  for (const p of packages) if (!/^[A-Za-z0-9_.]+$/.test(p)) throw new Error('INVALID_ANDROID_PACKAGE');
  const joined = packages.join(',');
  const cmd = `am start -n app.morphe.manager/app.morphe.manager.MainActivity -a app.morphe.manager.action.BATCH_PATCH --esa packages ${joined}`;
  return run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(cmd)}`, broccoliRoot);
}
