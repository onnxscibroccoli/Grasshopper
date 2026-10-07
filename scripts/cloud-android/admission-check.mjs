#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { evaluateAndroidAdmission } from "../../lib/cloud-android/admission.mjs";

const args = process.argv.slice(2);
const index = args.indexOf("--requested-mb");
const requestedMb = Number(index >= 0 ? args[index + 1] : process.env.CLOUD_ANDROID_MEMORY_MB || 1024);
const reserveMb = Number(process.env.CLOUD_ANDROID_HOST_RESERVE_MB || 2048);
const overheadMb = Number(process.env.CLOUD_ANDROID_LAUNCH_OVERHEAD_MB || 512);
const minSwapFreeMb = Number(process.env.CLOUD_ANDROID_MIN_SWAP_FREE_MB || 512);

function meminfo() {
  const out = {};
  for (const line of fs.readFileSync("/proc/meminfo", "utf8").split("\n")) {
    const m = line.match(/^(MemTotal|MemAvailable|SwapTotal|SwapFree):\s+(\d+)\s+kB$/);
    if (m) out[m[1]] = Number(m[2]) * 1024;
  }
  return out;
}

function qemuUsage() {
  let rss = 0, count = 0;
  for (const name of fs.readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const cmd = fs.readFileSync(`/proc/${name}/cmdline`, "utf8").replace(/\0/g, " ");
      if (!/qemu-(system|kvm)/.test(cmd)) continue;
      const status = fs.readFileSync(`/proc/${name}/status`, "utf8");
      const m = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
      rss += Number(m?.[1] || 0) * 1024;
      count += 1;
    } catch {}
  }
  return { rss, count };
}

const m = meminfo();
const q = qemuUsage();
const assessment = evaluateAndroidAdmission({
  memTotalBytes: m.MemTotal, memAvailableBytes: m.MemAvailable,
  swapTotalBytes: m.SwapTotal, swapFreeBytes: m.SwapFree,
  existingQemuRssBytes: q.rss, existingQemuCount: q.count,
  requestedMb, reserveMb, overheadMb, minSwapFreeMb
});
const capturedAt = new Date().toISOString();
const report = {
  schema: "grasshopper.cloud-android-admission/v1",
  captured_at: capturedAt,
  host: process.env.HOSTNAME || "",
  ...assessment
};
const dir = path.resolve(process.env.CLOUD_ANDROID_ADMISSION_EVIDENCE_DIR ||
  path.join(process.env.HOME || "/tmp", ".grasshopper/audit/cloud-android/admission"));
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = path.join(dir, `admission-${capturedAt.replace(/[-:.]/g, "")}.json`);
fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
fs.copyFileSync(file, path.join(dir, "latest.json"));
fs.chmodSync(path.join(dir, "latest.json"), 0o600);
console.log(JSON.stringify({ ...report, evidence_file: file }, null, 2));
process.exit(report.decision === "PASS" ? 0 : 75);
