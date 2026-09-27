#!/usr/bin/env node
/**
 * Fail-closed clean-host dry-run wrapper.
 *
 * Runs static repository validators relevant to clean-host reconstruction.
 * Exit 0 only when ALL of:
 *   - reconstruction-manifest.json gates.clean_host_reconstruction !== "blocked"
 *   - verify:agentic-deploy-readiness exits 0 (no critical OPEN gates)
 *   - listed static validators exit 0
 *
 * Today clean_host_reconstruction is blocked, so this script is expected to
 * exit non-zero. Static PASS on individual validators is NOT clean-host COMPLETE.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readManifest() {
  const p = path.join(ROOT, "reference/production/reconstruction-manifest.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function runNpm(script) {
  const r = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env
  });
  return {
    script,
    status: r.status ?? 1,
    stdout: r.stdout || "",
    stderr: r.stderr || ""
  };
}

const manifest = readManifest();
const gate = manifest?.gates?.clean_host_reconstruction;
const results = [];

const scripts = [
  "validate:production-baseline",
  "validate:service-lifecycle",
  "validate:canonical-agent-source",
  "validate:canonical-agent-executor",
  "validate:production-agent-artifact",
  "validate:rds-infrastructure",
  "validate:helix-lineage-pin",
  "verify:agentic-deploy-readiness"
];

for (const s of scripts) {
  results.push(runNpm(s));
}

const blocked = gate === "blocked";
const readiness = results.find((r) => r.script === "verify:agentic-deploy-readiness");
const readinessOpen = (readiness?.status ?? 1) !== 0;
const validatorFail = results.some(
  (r) => r.script !== "verify:agentic-deploy-readiness" && r.status !== 0
);

const report = {
  status: blocked || readinessOpen || validatorFail ? "FAIL_CLOSED" : "PASS",
  clean_host_reconstruction: gate ?? "missing",
  blocked,
  readinessOpen,
  validatorFail,
  note: "Static dry-run ≠ live clean-host COMPLETE. Dirty prod 46ba4b7 is evidence-only.",
  results: results.map((r) => ({ script: r.script, exit: r.status }))
};

console.log(JSON.stringify(report, null, 2));

if (blocked || readinessOpen || validatorFail) {
  process.exit(1);
}
process.exit(0);
