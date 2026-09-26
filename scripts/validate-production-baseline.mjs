import fs from "node:fs";

const baselinePath = "reference/production/observed-db-baseline.json";
const manifestPath = "reference/production/reconstruction-manifest.json";
const migrationDir = "reference/production/helix-accepted/migrations";
const requiredMigrations = ["0001_auth.sql","0002_workspaces.sql","0003_stream.sql","0004_omnikali_tasks.sql"];

for (const file of [baselinePath, manifestPath]) {
  if (!fs.existsSync(file)) throw new Error(`missing required evidence: ${file}`);
}
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
if (baseline.status !== "observed-baseline") throw new Error("baseline status is not observed-baseline");
if (manifest.status !== "reconstruction-gate") throw new Error("manifest status is not reconstruction-gate");
if (manifest.source_of_truth?.repository !== "onnxscibroccoli/helix") throw new Error("source-of-truth repository mismatch");
if (manifest.source_of_truth?.accepted_production_fix !== "38903b021cca75189a99e1ed88b508bae577f048") throw new Error("accepted production fix mismatch");
if (manifest.source_of_truth?.deployed_checkout_clean !== false) throw new Error("dirty deployed checkout must remain explicit");

const ledger = baseline.database?.migration_ledger;
if (!Array.isArray(ledger) || ledger.map(x => x.filename).join(",") !== requiredMigrations.join(",")) throw new Error("migration ledger does not match recovered production ordering");
for (const migration of requiredMigrations) {
  if (!baseline.migration_sha256?.[migration]) throw new Error(`missing live SHA-256 evidence for ${migration}`);
  if (!fs.existsSync(`${migrationDir}/${migration}`)) throw new Error(`missing accepted migration evidence: ${migration}`);
}
const task = baseline.task_contract;
if (!task?.idempotency_unique || !task?.lease_claim_index || !task?.workspace_foreign_key || !task?.task_event_foreign_key || !task?.task_event_index) throw new Error("recovered task contract is incomplete");
if (baseline.security_finding?.least_privilege_status !== "requires-hardening") throw new Error("security finding status is unexpectedly changed");
for (const key of ["clean_release_lineage","clean_host_reconstruction","production_mutation","rollback_recovery_evidence"]) {
  if (manifest.gates?.[key] !== "blocked") throw new Error(`${key} must remain fail-closed`);
}
if (manifest.safety?.production_mutation_allowed !== false) throw new Error("production mutation must remain disabled");
if (manifest.safety?.secrets_in_source !== false || manifest.safety?.credential_values_in_manifest !== false) throw new Error("secret-safety boundary violated");
console.log(JSON.stringify({status:"PASS",checked:{sourceOfTruth:manifest.source_of_truth.accepted_production_fix,deployedCheckout:manifest.source_of_truth.deployed_checkout,migrationOrder:requiredMigrations,acceptedMigrationEvidence:requiredMigrations.length,taskContract:"observed",productionMutation:"blocked"}}));
