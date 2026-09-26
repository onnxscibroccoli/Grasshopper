import fs from "node:fs";
import crypto from "node:crypto";

const baselinePath = "reference/production/observed-db-baseline.json";
const requiredMigrations = [
  "0001_auth.sql",
  "0002_workspaces.sql",
  "0003_stream.sql",
  "0004_omnikali_tasks.sql"
];

if (!fs.existsSync(baselinePath)) {
  throw new Error(`missing observed baseline: ${baselinePath}`);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
if (baseline.status !== "observed-baseline") throw new Error("baseline status is not observed-baseline");

const ledger = baseline.database?.migration_ledger;
if (!Array.isArray(ledger) || ledger.map(x => x.filename).join(",") !== requiredMigrations.join(",")) {
  throw new Error("migration ledger does not match the recovered production ordering");
}

const hashes = baseline.migration_sha256;
for (const migration of requiredMigrations) {
  if (!hashes?.[migration]) throw new Error(`missing SHA-256 evidence for ${migration}`);
}

const task = baseline.task_contract;
if (!task?.idempotency_unique || !task?.lease_claim_index || !task?.workspace_foreign_key || !task?.task_event_foreign_key || !task?.task_event_index) {
  throw new Error("recovered task contract is incomplete");
}

const security = baseline.security_finding;
if (security?.least_privilege_status !== "requires-hardening") {
  throw new Error("security finding status is unexpectedly changed");
}

console.log(JSON.stringify({
  status: "PASS",
  checked: {
    migrationOrder: requiredMigrations,
    migrationEvidence: requiredMigrations.length,
    taskContract: "observed",
    securityHardening: "required"
  }
}));
