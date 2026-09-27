import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts/verify-agentic-deploy-readiness.mjs");

function runVerifier(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8"
  });
}

test("agentic deploy readiness script exists and is executable entrypoint", () => {
  assert.equal(fs.existsSync(SCRIPT), true);
  const source = fs.readFileSync(SCRIPT, "utf8");
  assert.match(source, /fail-closed/);
  assert.match(source, /agentic-deploy-readiness/);
});

test("package.json exposes verify:agentic-deploy-readiness", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts["verify:agentic-deploy-readiness"],
    "node scripts/verify-agentic-deploy-readiness.mjs"
  );
});

test("docs/AGENTIC_DEPLOY_READINESS.md exists and disclaims live reproduction", () => {
  const doc = fs.readFileSync(path.join(ROOT, "docs/AGENTIC_DEPLOY_READINESS.md"), "utf8");
  assert.match(doc, /static gate/i);
  assert.match(doc, /not.*live reproduction|does not.*live/i);
  assert.match(doc, /Neon is not production/i);
  assert.match(doc, /Do not introduce Neon/i);
});

test("verifier fails closed today (exit 1) with critical OPEN gates", () => {
  const result = runVerifier(["--json"]);
  assert.equal(result.status, 1, `expected exit 1, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ready, false);
  assert.equal(report.summary.verified_restore_points, 1);
  assert.equal(report.summary.required_restore_points, 14);
  for (const id of [
    "lineage",
    "production_secrets_cutover",
    "live_acceptance_automation",
    "backup_retention",
    "clean_host_reconstruction"
  ]) {
    assert.ok(report.summary.critical_open.includes(id), `expected critical OPEN ${id}`);
  }
  assert.equal(
    report.summary.critical_open.includes("secrets_injection_contract"),
    false,
    "secrets_injection_contract must not be critical OPEN when repo evidence is present"
  );
  assert.ok(
    report.summary.gates_complete.includes("secrets_injection_contract"),
    "expected secrets_injection_contract COMPLETE"
  );
});

test("secrets_injection_contract COMPLETE from repo evidence; production cutover remains OPEN", () => {
  const result = runVerifier(["--json"]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const contract = report.gates.find((g) => g.id === "secrets_injection_contract");
  const cutover = report.gates.find((g) => g.id === "production_secrets_cutover");
  assert.ok(contract, "missing secrets_injection_contract gate");
  assert.ok(cutover, "missing production_secrets_cutover gate");
  assert.equal(contract.status, "COMPLETE");
  assert.equal(cutover.status, "OPEN");
  assert.match(contract.evidence, /Secrets Manager|HELIX_AGENT_TOKEN_SECRET_ID|agent-bridge-token/i);
  assert.match(cutover.evidence, /not re-verified|historical evidence only/i);
});

test("verifier reports known-complete repository artifacts and OPEN Grok until present", () => {
  const result = runVerifier(["--json"]);
  const report = JSON.parse(result.stdout);
  for (const id of [
    "executor_contract",
    "durable_executor",
    "rds_infra_module",
    "backup_runner_policy",
    "production_reproducibility_docs"
  ]) {
    assert.ok(report.summary.artifacts_complete.includes(id), `expected COMPLETE artifact ${id}`);
  }
  const grokPresent = fs.existsSync(path.join(ROOT, "src/grok-control-plane-client.mjs"));
  if (grokPresent) {
    assert.ok(report.summary.artifacts_complete.includes("grok_control_plane_client"));
  } else {
    assert.ok(report.summary.artifacts_open.includes("grok_control_plane_client"));
  }
});

test("structure checks for key production files without introducing Neon", () => {
  const required = [
    "src/executor-contract.mjs",
    "src/production/durable-agent-executor.mjs",
    "infra/aws/control-plane-db/main.tf",
    "scripts/independent-postgres-backup.mjs",
    "lib/independent-backup-policy.mjs",
    "docs/PRODUCTION_REPRODUCIBILITY.md",
    "docs/PRODUCTION_RECONSTRUCTION_STATUS.md",
    "reference/production/reconstruction-manifest.json"
  ];
  for (const rel of required) {
    assert.equal(fs.existsSync(path.join(ROOT, rel)), true, `missing ${rel}`);
  }
  const pkg = fs.readFileSync(path.join(ROOT, "package.json"), "utf8");
  assert.doesNotMatch(pkg, /@neondatabase|neondb/i);
  const report = JSON.parse(runVerifier(["--json"]).stdout);
  const neonGate = report.gates.find((g) => g.id === "no_neon_production");
  assert.ok(neonGate);
  assert.equal(neonGate.status, "COMPLETE");
});

test("text summary includes COMPLETE and OPEN sections", () => {
  const result = runVerifier([]);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /COMPLETE artifacts:/);
  assert.match(result.stdout, /OPEN gates:/);
  assert.match(result.stdout, /Critical OPEN blockers:/);
  assert.match(result.stdout, /Verified restore points: 1\/14/);
});
