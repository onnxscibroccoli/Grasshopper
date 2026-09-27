import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const reconPath = "reference/production/migration-byte-reconciliation.json";
const baselinePath = "reference/production/observed-db-baseline.json";
const migDir = "reference/production/helix-accepted/migrations";
const helixAccepted = "38903b021cca75189a99e1ed88b508bae577f048";
const deployed = "46ba4b71158a74db5ede97e300099370792ecff8";

function fail(msg) {
  throw new Error(msg);
}

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

if (!fs.existsSync(reconPath)) fail(`missing ${reconPath}`);
if (!fs.existsSync(baselinePath)) fail(`missing ${baselinePath}`);

const recon = JSON.parse(fs.readFileSync(reconPath, "utf8"));
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

if (recon.status !== "evidence-fail-closed") fail("status must be evidence-fail-closed");
if (recon.helix_accepted_sha !== helixAccepted) fail("helix_accepted_sha mismatch");
if (recon.deployed_checkout_sha !== deployed) fail("deployed_checkout_sha mismatch");
if (recon.gates?.migration_byte_identity !== "blocked") fail("migration_byte_identity must remain blocked");
if (recon.gates?.production_mutation !== "blocked") fail("production_mutation must remain blocked");
if (recon.safety?.production_mutation_allowed !== false) fail("production_mutation_allowed must be false");
if (recon.safety?.live_migration_bytes_invented !== false) fail("must not invent live migration bytes");
if (recon.safety?.secrets_in_artifact !== false) fail("secrets_in_artifact must be false");

const live = baseline.migration_sha256;
if (!live || typeof live !== "object") fail("baseline migration_sha256 missing");

const expectedNames = ["0001_auth.sql", "0002_workspaces.sql", "0003_stream.sql", "0004_omnikali_tasks.sql"];
if (!Array.isArray(recon.files) || recon.files.length !== 4) fail("files must list exactly four migrations");

const byName = Object.fromEntries(recon.files.map((f) => [f.name, f]));
for (const name of expectedNames) {
  const row = byName[name];
  if (!row) fail(`missing file row ${name}`);
  const disk = path.join(migDir, name);
  if (!fs.existsSync(disk)) fail(`missing reference migration ${disk}`);
  const got = sha256File(disk);
  if (got !== row.grasshopper_reference_sha256) {
    fail(`${name}: disk sha ${got} != recon grasshopper_reference_sha256 ${row.grasshopper_reference_sha256}`);
  }
  if (row.live_sha256 !== live[name]) {
    fail(`${name}: recon live_sha256 != observed-db-baseline`);
  }
  if (typeof row.helix_sha256 !== "string" || row.helix_sha256.length !== 64) {
    fail(`${name}: invalid helix_sha256`);
  }
  const heg = row.helix_sha256 === row.grasshopper_reference_sha256;
  const gel = row.grasshopper_reference_sha256 === row.live_sha256;
  const hel = row.helix_sha256 === row.live_sha256;
  if (row.helix_eq_grasshopper !== heg) fail(`${name}: helix_eq_grasshopper flag inconsistent`);
  if (row.grasshopper_eq_live !== gel) fail(`${name}: grasshopper_eq_live flag inconsistent`);
  if (row.helix_eq_live !== hel) fail(`${name}: helix_eq_live flag inconsistent`);
}

// Matrix invariants from Atom 3 evidence
const f1 = byName["0001_auth.sql"];
const f2 = byName["0002_workspaces.sql"];
const f3 = byName["0003_stream.sql"];
const f4 = byName["0004_omnikali_tasks.sql"];

if (!(f2.helix_eq_grasshopper && f2.grasshopper_eq_live && f2.helix_eq_live)) {
  fail("0002 must be identical across all three");
}
if (!(f3.helix_eq_grasshopper && f3.grasshopper_eq_live && f3.helix_eq_live)) {
  fail("0003 must be identical across all three");
}
if (f4.helix_eq_grasshopper || f4.helix_eq_live || !f4.grasshopper_eq_live) {
  fail("0004 must match live+grasshopper and differ from helix (trailing newline)");
}
if (f1.helix_eq_grasshopper || f1.grasshopper_eq_live || f1.helix_eq_live) {
  fail("0001 must differ across all three pairwise comparisons");
}
if (f1.live_content_diff_cause !== "UNKNOWN") {
  fail("0001 live_content_diff_cause must be UNKNOWN without live bytes");
}
if (f1.live_bytes_in_grasshopper_repo !== false) {
  fail("0001 live_bytes_in_grasshopper_repo must be false");
}

// Pin documented helix hashes (consistency with lineage pin when present)
const pinPath = "reference/production/helix-lineage-pin.json";
if (fs.existsSync(pinPath)) {
  const pin = JSON.parse(fs.readFileSync(pinPath, "utf8"));
  const mig = pin.accepted_migration_sha256_from_helix_checkout || {};
  for (const name of expectedNames) {
    if (mig[name] && mig[name] !== byName[name].helix_sha256) {
      fail(`${name}: helix sha diverges from helix-lineage-pin.json`);
    }
  }
}

console.log(
  JSON.stringify({
    status: "PASS",
    checked: {
      helixAccepted,
      deployed,
      migrationByteIdentity: "blocked",
      productionMutation: "blocked",
      identicalAllThree: ["0002_workspaces.sql", "0003_stream.sql"],
      drift: ["0001_auth.sql", "0004_omnikali_tasks.sql"],
      live0001ContentDiffCause: "UNKNOWN",
    },
  }),
);
