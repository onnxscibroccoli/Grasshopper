import { spawn } from 'node:child_process';

const run = (command, cwd) => new Promise((resolve, reject) => {
  const p = spawn('/bin/sh', ['-lc', command], { cwd });
  let stdout=''; let stderr='';
  p.stdout.on('data', d => stdout += d); p.stderr.on('data', d => stderr += d);
  p.on('error', reject); p.on('close', code => resolve({exitCode:code,stdout,stderr}));
});

export async function catalog({ broccoliRoot }) {
  const r = await run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify("pm list packages -3 | sed 's/^package://' | sort")}`, broccoliRoot);
  if (r.exitCode !== 0) throw new Error(`APP_CATALOG_FAILED: ${r.stderr || r.stdout}`);
  return { packages: r.stdout.split(/\\r?\\n/).map(x=>x.trim()).filter(Boolean), evidence: 'pm list packages -3 via known-good Rish wrapper' };
}

export async function optimizationPlan({ broccoliRoot, packages }) {
  const selected = Array.isArray(packages) && packages.length ? packages : ['com.android.chrome','com.sec.android.app.sbrowser','com.google.android.youtube','app.morphe.android.youtube','app.morphe.android.apps.youtube.music','anddea.youtube.music'];
  for (const p of selected) if (!/^[A-Za-z0-9_.]+$/.test(p)) throw new Error('INVALID_ANDROID_PACKAGE');
  const results=[];
  for (const p of selected) {
    const cmd = `p=${p}; apk=$(pm path "$p" 2>/dev/null | head -1 | cut -d: -f2-); size=$(stat -c '%s' "$apk" 2>/dev/null || echo 0); printf '%s\\t%s\\t%s\\n' "$p" "$size" "$apk"`;
    const r = await run(`RISH_PRESERVE_ENV=0 bash ./lib/rish_run.sh ${JSON.stringify(cmd)}`, broccoliRoot);
    const line = r.stdout.trim().split(/\\r?\\n/).filter(Boolean).pop() || '';
    const [packageName,size,apkPath] = line.split('\\t');
    results.push({ packageName, sizeBytes:Number(size||0), apkPath:apkPath||null });
  }
  return {
    devicePolicy: 'ARM64 Android 15/API 35; replacement requires installability, functional regression, automation compatibility, and rollback evidence.',
    results,
    candidates: {
      morpheYouTube: { packageName:'app.morphe.android.youtube', action:'CONTROL_AND_VERIFY' },
      morpheYouTubeMusic: { packageName:'app.morphe.android.apps.youtube.music', action:'CONTROL_AND_VERIFY' },
      anddeaYouTubeMusic: { packageName:'anddea.youtube.music', action:'COMPARE_BEFORE_REPLACING' },
      chrome: { packageName:'com.android.chrome', action:'MORPHE_SOURCE_AVAILABLE_FOR_EXPERIMENTAL_OPTIMIZATION' },
      samsungInternet: { packageName:'com.sec.android.app.sbrowser', action:'KEEP_UNTIL_REPLACEMENT_REGRESSION_GATE' },
    }
  };
}
