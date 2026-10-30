import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("reproducibility evidence is machine-readable and redacts remote credentials", async () => {
  const dir = await mkdtemp(join(tmpdir(), "grasshopper-repro-evidence-"));
  const out = join(dir, "proof.json");
  const env = {
    ...process.env,
    GRASSHOPPER_REPRO_COMMIT: "a".repeat(40),
    GRASSHOPPER_REPRO_NODE: "v24.0.0",
    GRASSHOPPER_REPRO_NPM: "11.0.0",
    GRASSHOPPER_REPRO_REMOTE: "https://secret-token@github.com/onnxscibroccoli/Grasshopper.git"
  };
  const run = spawnSync(process.execPath, ["scripts/emit-agentic-reproducibility-evidence.mjs", out], {
    cwd: process.cwd(),
    env,
    encoding: "utf8"
  });
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(await readFile(out, "utf8"));
  const latest = JSON.parse(await readFile(join(dir, "latest.json"), "utf8"));
  assert.equal(report.schema, "grasshopper.agentic-reproducibility-evidence/v1");
  assert.equal(report.status, "PASS");
  assert.equal(report.canonical_commit, "a".repeat(40));
  assert.equal(report.source_remote, "https://github.com/onnxscibroccoli/Grasshopper.git");
  assert.equal(report.production_credentials_required, false);
  assert.equal(report.live_production_mutation_performed, false);
  assert.deepEqual(latest, report);
});
