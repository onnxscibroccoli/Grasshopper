import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessProductionSecretsCutover } from "../lib/assess-production-secrets-cutover.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = path.join(ROOT, "test/fixtures/secrets-cutover");
const SCRIPT = path.join(ROOT, "scripts/verify-secrets-cutover-dryrun.mjs");

function readFix(...parts) {
  return fs.readFileSync(path.join(FIX, ...parts), "utf8");
}

function readRepo(...parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

const SECRETISH = /AGENT_TOKEN\s*=\s*['\"]?[A-Za-z0-9_\/+]{12,}|SecretString|AKIA[0-9A-Z]{16}/;

test("real ops docs keep production_secrets_cutover OPEN", () => {
  const gate = assessProductionSecretsCutover(
    readRepo("docs", "PRODUCTION_RECONSTRUCTION_STATUS.md"),
    readRepo("docs", "operations", "AGENT_SECRET_MIGRATION.md")
  );
  assert.equal(gate.status, "OPEN");
  assert.equal(gate.id, "production_secrets_cutover");
});

test("complete-both-signals fixture assesses COMPLETE", () => {
  const gate = assessProductionSecretsCutover(readFix("complete-both-signals.md"), "");
  assert.equal(gate.status, "COMPLETE");
});

test("pair-complete fixtures assess COMPLETE when concatenated", () => {
  const gate = assessProductionSecretsCutover(
    readFix("pair-complete", "reconstruction-status.md"),
    readFix("pair-complete", "migration.md")
  );
  assert.equal(gate.status, "COMPLETE");
});

test("negative fixtures stay OPEN", () => {
  const negatives = [
    ["open-missing-dated-claim.md"],
    ["open-missing-secret-ref.md"],
    ["open-historical-pr16-only.md"],
    ["open-empty.md"],
    ["pair-open-realshape", "reconstruction-status.md"]
  ];
  for (const parts of negatives) {
    const status = readFix(...parts);
    const migration =
      parts[0] === "pair-open-realshape"
        ? readFix("pair-open-realshape", "migration.md")
        : "";
    const gate = assessProductionSecretsCutover(status, migration);
    assert.equal(gate.status, "OPEN", parts.join("/"));
  }
});

test("fixtures are marked synthetic and contain no secret payloads", () => {
  const files = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".md")) files.push(p);
    }
  }
  walk(FIX);
  assert.ok(files.length >= 8);
  for (const f of files) {
    const text = fs.readFileSync(f, "utf8");
    if (path.basename(f) === "README.md") {
      assert.match(text, /SYNTHETIC|synthetic/i);
    } else {
      assert.match(text, /SYNTHETIC FIXTURE/);
    }
    assert.doesNotMatch(text, SECRETISH);
  }
});

test("package.json exposes verify:secrets-cutover-dryrun", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(
    pkg.scripts["verify:secrets-cutover-dryrun"],
    "node scripts/verify-secrets-cutover-dryrun.mjs"
  );
});

test("verify-secrets-cutover-dryrun exits 0 when fixtures match and real docs OPEN", () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 30000
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "PASS");
  assert.match(report.note, /Synthetic COMPLETE/);
  const real = report.results.find((r) => r.id === "real-ops-docs");
  assert.ok(real);
  assert.equal(real.actual, "OPEN");
  assert.equal(real.ok, true);
});

test("checklist Related points at dry-run pack without closing live gate", () => {
  const doc = readRepo("docs", "operations", "PRODUCTION_SECRETS_CUTOVER_REVERIFY.md");
  assert.match(doc, /test\/fixtures\/secrets-cutover/);
  assert.match(doc, /verify:secrets-cutover-dryrun/);
  assert.match(doc, /inventory \/ procedure only/i);
  assert.match(doc, /does \*\*not\*\* close the live gate/i);
});
