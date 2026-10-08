#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const BLOCKED_EXIT = 75;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function finiteNonnegative(value) {
  return Number.isFinite(value) && value >= 0;
}

export function evaluateAdmission(profile, snapshot, evidenceSource = "SIMULATED") {
  const policy = profile.resource_admission;
  if (!policy || snapshot.schema !== "grasshopper.builder-snapshot/v1") {
    return {
      schema: "grasshopper.builder-admission/v1",
      status: "BLOCKED",
      evidence_source: evidenceSource,
      failures: ["snapshot_schema"],
    };
  }

  const failures = [];
  if (snapshot.architecture !== policy.architecture) failures.push("architecture");
  if (!finiteNonnegative(snapshot.logical_cpus) || snapshot.logical_cpus < policy.minimum_logical_cpus) {
    failures.push("logical_cpus");
  }
  if (!finiteNonnegative(snapshot.memory_total_bytes) || snapshot.memory_total_bytes < policy.minimum_memory_total_bytes) {
    failures.push("memory_total_bytes");
  }
  if (!finiteNonnegative(snapshot.memory_available_bytes) || snapshot.memory_available_bytes < policy.minimum_memory_available_bytes) {
    failures.push("memory_available_bytes");
  }
  if (!finiteNonnegative(snapshot.workspace_free_bytes) || snapshot.workspace_free_bytes < policy.minimum_workspace_free_bytes) {
    failures.push("workspace_free_bytes");
  }
  const maximumLoad = snapshot.logical_cpus * policy.maximum_load_per_logical_cpu;
  if (!finiteNonnegative(snapshot.load_1m) || snapshot.load_1m > maximumLoad) failures.push("load_1m");
  if (!Number.isInteger(snapshot.qemu_processes) || snapshot.qemu_processes > policy.maximum_qemu_processes) {
    failures.push("active_qemu_processes");
  }
  if (evidenceSource !== "SIMULATED" && snapshot.process_scan_complete !== true) {
    failures.push("process_scan_ambiguous");
  }
  if (!finiteNonnegative(snapshot.lease_hours) || snapshot.lease_hours > policy.maximum_lease_hours) {
    failures.push("lease_hours");
  }
  if (policy.checkpoint_path_required && (typeof snapshot.checkpoint_path !== "string" || !snapshot.checkpoint_path.startsWith("/"))) {
    failures.push("checkpoint_path");
  }

  return {
    schema: "grasshopper.builder-admission/v1",
    status: failures.length ? "BLOCKED" : "PASS",
    evidence_source: evidenceSource,
    profile_id: profile.id,
    failures,
    observed: snapshot,
    required: policy,
  };
}

function main(argv) {
  if (argv.length !== 5 || argv[2] !== "evaluate") {
    console.error(`Usage: ${argv[1]} evaluate PROFILE.json SNAPSHOT.json`);
    return 64;
  }
  try {
    const profile = readJson(path.resolve(argv[3]));
    const snapshot = readJson(path.resolve(argv[4]));
    const report = evaluateAdmission(profile, snapshot, "SIMULATED");
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.status === "PASS" ? 0 : BLOCKED_EXIT;
  } catch (error) {
    console.error(`FAIL arm64_userdebug_builder_admission ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv));
