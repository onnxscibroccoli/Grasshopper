import fs from "node:fs";

const pinPath = "reference/production/helix-lineage-pin.json";
const manifestPath = "reference/production/reconstruction-manifest.json";
const acceptedSha = "38903b021cca75189a99e1ed88b508bae577f048";
const deployedSha = "46ba4b71158a74db5ede97e300099370792ecff8";
const repo = "onnxscibroccoli/helix";

function fail(msg) {
  throw new Error(msg);
}

if (!fs.existsSync(pinPath)) fail(`missing ${pinPath}`);
if (!fs.existsSync(manifestPath)) fail(`missing ${manifestPath}`);

const pin = JSON.parse(fs.readFileSync(pinPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (pin.status !== "pinned-fail-closed") fail("pin status must be pinned-fail-closed");
if (pin.canonical_repository !== repo) fail("canonical_repository mismatch");
if (pin.accepted_production_fix?.sha !== acceptedSha) fail("accepted_production_fix.sha mismatch");
if (pin.deployed_checkout_evidence?.sha !== deployedSha) fail("deployed_checkout_evidence.sha mismatch");
if (pin.deployed_checkout_evidence?.clean !== false) fail("deployed checkout must remain dirty/explicit");
if (pin.deployed_checkout_evidence?.present_in_helix_github_object_store !== false) {
  fail("deployed checkout must remain absent from Helix GitHub object store until proven otherwise");
}
if (pin.helix_main_at_verification?.is_descendant_of_accepted_fix !== false) {
  fail("helix main must not be treated as descendant of accepted fix");
}
if (pin.helix_main_at_verification?.ahead_behind_vs_accepted_fix?.main_behind !== 28) {
  fail("documented main_behind count mismatch (expected 28 at pin time)");
}
if (pin.safety?.production_mutation_allowed !== false) fail("production mutation must remain disabled");
if (pin.safety?.secrets_in_pin !== false || pin.safety?.credential_values_recorded !== false) {
  fail("secret-safety boundary violated");
}

for (const key of [
  "clean_release_lineage",
  "clean_host_reconstruction",
  "production_mutation",
  "executor_lineage",
  "rollback_recovery_evidence",
  "use_helix_main_alone_as_reconstruction_source",
]) {
  if (pin.gates?.[key] !== "blocked") fail(`gate ${key} must remain blocked`);
}
if (pin.gates?.blind_overwrite_of_live_production_checkout !== "forbidden") {
  fail("blind overwrite must remain forbidden");
}
if (pin.gates?.iam_weakening !== "forbidden") fail("iam_weakening must remain forbidden");

if (manifest.source_of_truth?.repository !== repo) fail("manifest repository mismatch");
if (manifest.source_of_truth?.accepted_production_fix !== acceptedSha) fail("manifest accepted fix mismatch");
if (manifest.source_of_truth?.deployed_checkout !== deployedSha) fail("manifest deployed checkout mismatch");
if (manifest.source_of_truth?.deployed_checkout_clean !== false) fail("manifest dirty flag mismatch");
if (manifest.safety?.production_mutation_allowed !== false) fail("manifest production mutation must stay false");
for (const key of ["clean_release_lineage", "clean_host_reconstruction", "production_mutation", "rollback_recovery_evidence"]) {
  if (manifest.gates?.[key] !== "blocked") fail(`manifest gate ${key} must remain blocked`);
}

const missing = pin.acceptance_tree_gaps?.missing_paths_in_accepted_fix;
if (!Array.isArray(missing) || missing.length < 2) fail("acceptance_tree_gaps.missing_paths incomplete");

const mig = pin.accepted_migration_sha256_from_helix_checkout;
for (const name of ["0001_auth.sql", "0002_workspaces.sql", "0003_stream.sql", "0004_omnikali_tasks.sql"]) {
  if (!mig?.[name] || typeof mig[name] !== "string" || mig[name].length !== 64) {
    fail(`missing/invalid helix migration sha for ${name}`);
  }
}

console.log(
  JSON.stringify({
    status: "PASS",
    checked: {
      acceptedProductionFix: acceptedSha,
      helixMainAtPin: pin.helix_main_at_verification.sha,
      mainBehindAccepted: 28,
      deployedCheckout: deployedSha,
      productionMutation: "blocked",
      cleanReleaseLineage: "blocked",
    },
  }),
);
