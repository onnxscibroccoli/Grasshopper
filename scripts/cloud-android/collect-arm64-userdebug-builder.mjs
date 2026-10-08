#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateAdmission } from "./admit-arm64-userdebug-builder.mjs";

const BLOCKED_EXIT = 75;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  const bytes = typeof value === "string" ? value : canonical(value);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function normalizeArchitecture(arch) {
  return arch === "arm64" ? "aarch64" : arch;
}

export function scanQemuProcesses(procRoot = "/proc") {
  const pids = [];
  const errors = [];
  for (const entry of fs.readdirSync(procRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    const pid = Number(entry.name);
    try {
      const executable = path.basename(fs.readlinkSync(path.join(procRoot, entry.name, "exe")));
      if (/^qemu-system(?:-|$)/.test(executable)) pids.push(pid);
    } catch (error) {
      if (error.code !== "ENOENT") errors.push({ pid, code: error.code || "UNKNOWN" });
    }
  }
  pids.sort((left, right) => left - right);
  errors.sort((left, right) => left.pid - right.pid);
  return { pids, errors, complete: errors.length === 0 };
}

function collectSnapshot(workspace, checkpointPath, leaseHours, procRoot) {
  const processScan = scanQemuProcesses(procRoot);
  const filesystem = fs.statfsSync(workspace, { bigint: true });
  const architecture = normalizeArchitecture(process.arch);
  return {
    schema: "grasshopper.builder-snapshot/v1",
    collected_utc: new Date().toISOString(),
    hostname: os.hostname(),
    architecture,
    logical_cpus: os.cpus().length,
    memory_total_bytes: os.totalmem(),
    memory_available_bytes: os.freemem(),
    workspace_path: path.resolve(workspace),
    workspace_free_bytes: Number(filesystem.bavail * filesystem.bsize),
    load_1m: os.loadavg()[0],
    qemu_processes: processScan.pids.length,
    qemu_pids: processScan.pids,
    process_scan_complete: processScan.complete,
    process_scan_errors: processScan.errors,
    lease_hours: leaseHours,
    checkpoint_path: path.resolve(checkpointPath),
  };
}

function buildEvidence(profileBytes, profile, snapshot, evidenceSource) {
  const admission = evaluateAdmission(profile, snapshot, evidenceSource);
  const profileSha256 = digest(profileBytes);
  const snapshotSha256 = digest(snapshot);
  const admissionSha256 = digest(admission);
  return {
    schema: "grasshopper.builder-admission-evidence/v1",
    evidence_source: evidenceSource,
    profile_id: profile.id,
    snapshot,
    admission,
    integrity: {
      algorithm: "sha256",
      canonicalization: "recursive-key-sort-json/v1",
      profile_sha256: profileSha256,
      snapshot_sha256: snapshotSha256,
      admission_sha256: admissionSha256,
      evidence_set_sha256: digest({ profileSha256, snapshotSha256, admissionSha256 }),
    },
  };
}

function verifyEvidence(profileBytes, profile, evidence) {
  if (evidence.schema !== "grasshopper.builder-admission-evidence/v1") throw new Error("evidence schema mismatch");
  if (evidence.evidence_source !== "LIVE" || evidence.admission?.evidence_source !== "LIVE") {
    throw new Error("LIVE evidence required");
  }
  if (evidence.integrity?.profile_sha256 !== digest(profileBytes)) throw new Error("profile digest mismatch");
  if (evidence.integrity?.snapshot_sha256 !== digest(evidence.snapshot)) throw new Error("snapshot digest mismatch");
  if (evidence.integrity?.admission_sha256 !== digest(evidence.admission)) throw new Error("admission digest mismatch");
  const evidenceSetSha256 = digest({
    profileSha256: evidence.integrity.profile_sha256,
    snapshotSha256: evidence.integrity.snapshot_sha256,
    admissionSha256: evidence.integrity.admission_sha256,
  });
  if (evidence.integrity.evidence_set_sha256 !== evidenceSetSha256) throw new Error("evidence-set digest mismatch");
  const expectedAdmission = evaluateAdmission(profile, evidence.snapshot, "LIVE");
  if (canonical(expectedAdmission) !== canonical(evidence.admission)) throw new Error("admission replay mismatch");
  return evidence.admission;
}

function usage(argv) {
  console.error(`Usage:\n  ${argv[1]} collect PROFILE WORKSPACE CHECKPOINT LEASE_HOURS EVIDENCE.json [PROC_ROOT]\n  ${argv[1]} verify PROFILE EVIDENCE.json`);
  return 64;
}

function main(argv) {
  try {
    if (argv[2] === "collect" && (argv.length === 8 || argv.length === 9)) {
      const [, , , profileFile, workspace, checkpointPath, leaseText, evidenceFile, procRoot = "/proc"] = argv;
      const leaseHours = Number(leaseText);
      if (!Number.isFinite(leaseHours) || leaseHours < 0) throw new Error("lease must be a nonnegative number");
      if (!path.isAbsolute(workspace) || !path.isAbsolute(checkpointPath) || !path.isAbsolute(evidenceFile)) {
        throw new Error("workspace, checkpoint and evidence paths must be absolute");
      }
      const profileBytes = fs.readFileSync(profileFile, "utf8");
      const profile = JSON.parse(profileBytes);
      const snapshot = collectSnapshot(workspace, checkpointPath, leaseHours, procRoot);
      const evidenceSource = path.resolve(procRoot) === "/proc" ? "LIVE" : "TEST_FIXTURE";
      const evidence = buildEvidence(profileBytes, profile, snapshot, evidenceSource);
      fs.writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
      process.stdout.write(`${JSON.stringify({ status: evidence.admission.status, evidence_file: evidenceFile, evidence_set_sha256: evidence.integrity.evidence_set_sha256 })}\n`);
      return evidence.admission.status === "PASS" ? 0 : BLOCKED_EXIT;
    }
    if (argv[2] === "verify" && argv.length === 5) {
      const profileBytes = fs.readFileSync(argv[3], "utf8");
      const profile = JSON.parse(profileBytes);
      const admission = verifyEvidence(profileBytes, profile, readJson(argv[4]));
      console.log(`PASS arm64_userdebug_builder_live_evidence status=${admission.status}`);
      return 0;
    }
    return usage(argv);
  } catch (error) {
    console.error(`FAIL arm64_userdebug_builder_live_evidence ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv));
