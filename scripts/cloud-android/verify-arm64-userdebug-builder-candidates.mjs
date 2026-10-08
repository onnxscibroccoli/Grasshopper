#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { evaluateAdmission } from "./admit-arm64-userdebug-builder.mjs";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function classifyCandidate(profile, candidate) {
  if (candidate.protected === true) {
    return { id: candidate.id, status: "EXCLUDED_PROTECTED", failures: [] };
  }
  if (candidate.requires_new_provisioning === true) {
    return { id: candidate.id, status: "EXCLUDED_PROVISIONING_REQUIRED", failures: [] };
  }
  if (candidate.requires_paid_provisioning === true) {
    return { id: candidate.id, status: "EXCLUDED_PAID_PROVISIONING", failures: [] };
  }
  if (candidate.access_status !== "VERIFIED" || candidate.identity_status !== "VERIFIED") {
    return { id: candidate.id, status: "UNQUALIFIED_IDENTITY", failures: [] };
  }
  if (!candidate.snapshot) {
    return { id: candidate.id, status: "UNQUALIFIED_NO_SNAPSHOT", failures: [] };
  }
  const admission = evaluateAdmission(profile, candidate.snapshot, "SIMULATED");
  if (admission.status !== "PASS") {
    return { id: candidate.id, status: "BLOCKED_RESOURCE_ADMISSION", failures: admission.failures };
  }
  return { id: candidate.id, status: "ELIGIBLE_FOR_LIVE_COLLECTION", failures: [] };
}

function evaluateInventory(profile, inventory) {
  if (inventory.schema !== "grasshopper.builder-candidate-inventory/v1") {
    throw new Error("candidate inventory schema mismatch");
  }
  if (!Array.isArray(inventory.candidates) || inventory.candidates.length === 0) {
    throw new Error("candidate inventory must contain candidates");
  }
  const candidates = inventory.candidates.map((candidate) => classifyCandidate(profile, candidate));
  const eligible = candidates.some((candidate) => candidate.status === "ELIGIBLE_FOR_LIVE_COLLECTION");
  return {
    schema: "grasshopper.builder-candidate-evaluation/v1",
    overall_status: eligible ? "LIVE_COLLECTION_CANDIDATE" : "NO_ELIGIBLE_NODE",
    build_authorized: false,
    candidates,
  };
}

function verifyInventory(profile, inventory) {
  if (inventory.build_authorized !== false) throw new Error("build_authorized must remain false");
  const report = evaluateInventory(profile, inventory);
  if (inventory.overall_status !== report.overall_status) throw new Error("overall status mismatch");
  for (let index = 0; index < inventory.candidates.length; index += 1) {
    const declared = inventory.candidates[index].declared_status;
    const observed = report.candidates[index].status;
    if (declared !== observed) throw new Error(`candidate status mismatch: ${inventory.candidates[index].id}`);
  }
  return report;
}

function main(argv) {
  try {
    if (argv.length !== 5 || !["evaluate", "verify"].includes(argv[2])) {
      console.error(`Usage: ${argv[1]} <evaluate|verify> PROFILE.json INVENTORY.json`);
      return 64;
    }
    const profile = readJson(path.resolve(argv[3]));
    const inventory = readJson(path.resolve(argv[4]));
    const report = argv[2] === "verify"
      ? verifyInventory(profile, inventory)
      : evaluateInventory(profile, inventory);
    if (argv[2] === "evaluate") {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      console.log(`PASS arm64_userdebug_builder_candidates overall=${report.overall_status} build_authorized=${report.build_authorized}`);
    }
    return 0;
  } catch (error) {
    console.error(`FAIL arm64_userdebug_builder_candidates ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv));
