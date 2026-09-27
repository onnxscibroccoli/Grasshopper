import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const livePinDir = "reference/production/overlays/live-pin";
const manifestPath = path.join(livePinDir, "MANIFEST.json");

const LOCKED = {
  "omni-agent.mjs": {
    sha256: "ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d",
    size_bytes: 4040,
  },
  "agent-executor.mjs": {
    sha256: "6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e",
    size_bytes: 910,
  },
};

const HARDENING_DELTA = {
  "omni-agent.mjs": "ffd3d5981cb8cc749cb112d312018b119c95e5613376f1695c59e226aed9b349",
  "agent-executor.mjs": "d1ad94d942ebfd0898c79a18d649b5628bb7a31ce10cdbaf01cf57e4353758c2",
};

function fail(msg) {
  throw new Error(msg);
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return {
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
    size_bytes: buf.length,
  };
}

if (!fs.existsSync(manifestPath)) fail(`missing ${manifestPath}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

if (manifest.schema !== "grasshopper.live-pin-overlays.v1") {
  fail("manifest schema must be grasshopper.live-pin-overlays.v1");
}
if (manifest.status !== "populated-fail-closed") {
  fail("manifest status must be populated-fail-closed");
}
if (manifest.safety?.production_mutation_allowed !== false) {
  fail("production_mutation_allowed must be false");
}
if (manifest.safety?.secrets_in_manifest !== false) {
  fail("secrets_in_manifest must be false");
}
if (manifest.safety?.blind_overwrite_of_live_production_checkout !== "forbidden") {
  fail("blind overwrite must remain forbidden");
}
if (manifest.gates?.executor_lineage !== "blocked") {
  fail("executor_lineage must remain blocked");
}
if (manifest.gates?.g1_live_pin_import !== "satisfied-by-this-tree") {
  fail("g1_live_pin_import must be satisfied-by-this-tree");
}
if (manifest.helix?.artifacts_in_accepted_tree !== false) {
  fail("artifacts_in_accepted_tree must be false (do not invent Helix presence)");
}
if (manifest.helix?.do_not_invent_helix_history !== true) {
  fail("do_not_invent_helix_history must be true");
}
if (manifest.helix?.accepted_sha !== "38903b021cca75189a99e1ed88b508bae577f048") {
  fail("accepted_sha mismatch");
}
if (manifest.helix?.accepted_tag !== "clean-reconstruction-38903b0") {
  fail("accepted_tag mismatch");
}

const artifacts = manifest.artifacts;
if (!Array.isArray(artifacts) || artifacts.length !== 2) {
  fail("manifest.artifacts must list exactly the two LIVE overlays");
}

const checked = {};
for (const art of artifacts) {
  const name = art.path;
  if (!LOCKED[name]) fail(`unexpected artifact path ${name}`);
  const filePath = path.join(livePinDir, name);
  if (!fs.existsSync(filePath)) fail(`missing ${filePath}`);
  const actual = sha256File(filePath);
  if (art.sha256 !== LOCKED[name].sha256) {
    fail(`manifest sha256 for ${name} does not match locked LIVE digest`);
  }
  if (art.size_bytes !== LOCKED[name].size_bytes) {
    fail(`manifest size_bytes for ${name} does not match locked LIVE size`);
  }
  if (actual.sha256 !== LOCKED[name].sha256) {
    fail(`file ${name} sha256 ${actual.sha256} != locked LIVE ${LOCKED[name].sha256}`);
  }
  if (actual.size_bytes !== LOCKED[name].size_bytes) {
    fail(`file ${name} size ${actual.size_bytes} != locked LIVE ${LOCKED[name].size_bytes}`);
  }
  if (actual.sha256 === HARDENING_DELTA[name]) {
    fail(`${name} must not be the Grasshopper hardening delta digest`);
  }
  const deltaListed = manifest.grasshopper_hardening_delta_not_live?.[name];
  if (deltaListed !== HARDENING_DELTA[name]) {
    fail(`hardening delta digest for ${name} must be recorded as ${HARDENING_DELTA[name]}`);
  }
  checked[name] = actual;
}

for (const name of Object.keys(LOCKED)) {
  if (!checked[name]) fail(`missing locked artifact ${name} in manifest.artifacts`);
}

console.log(
  JSON.stringify({
    status: "PASS",
    checked: {
      livePinDir,
      artifacts: checked,
      executor_lineage: "blocked",
      g1_live_pin_import: "satisfied-by-this-tree",
      production_mutation: "blocked",
    },
  }),
);
