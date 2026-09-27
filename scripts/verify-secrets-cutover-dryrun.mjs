#!/usr/bin/env node
/**
 * Fail-closed dry-run for production_secrets_cutover doc assessor.
 *
 * Exercises synthetic fixtures under test/fixtures/secrets-cutover/.
 * Also asserts real ops docs remain OPEN (no accidental COMPLETE claim).
 *
 * Synthetic COMPLETE ≠ live production_secrets_cutover COMPLETE.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessProductionSecretsCutover } from "../lib/assess-production-secrets-cutover.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIX = path.join(ROOT, "test/fixtures/secrets-cutover");

function read(rel) {
  const full = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

function readFix(...parts) {
  return fs.readFileSync(path.join(FIX, ...parts), "utf8");
}

const cases = [
  {
    id: "complete-both-signals",
    expected: "COMPLETE",
    status: () => readFix("complete-both-signals.md"),
    migration: () => ""
  },
  {
    id: "open-missing-dated-claim",
    expected: "OPEN",
    status: () => readFix("open-missing-dated-claim.md"),
    migration: () => ""
  },
  {
    id: "open-missing-secret-ref",
    expected: "OPEN",
    status: () => readFix("open-missing-secret-ref.md"),
    migration: () => ""
  },
  {
    id: "open-historical-pr16-only",
    expected: "OPEN",
    status: () => readFix("open-historical-pr16-only.md"),
    migration: () => ""
  },
  {
    id: "open-empty",
    expected: "OPEN",
    status: () => readFix("open-empty.md"),
    migration: () => ""
  },
  {
    id: "pair-complete",
    expected: "COMPLETE",
    status: () => readFix("pair-complete", "reconstruction-status.md"),
    migration: () => readFix("pair-complete", "migration.md")
  },
  {
    id: "pair-open-realshape",
    expected: "OPEN",
    status: () => readFix("pair-open-realshape", "reconstruction-status.md"),
    migration: () => readFix("pair-open-realshape", "migration.md")
  },
  {
    id: "real-ops-docs",
    expected: "OPEN",
    status: () => read("docs/PRODUCTION_RECONSTRUCTION_STATUS.md"),
    migration: () => read("docs/operations/AGENT_SECRET_MIGRATION.md")
  }
];

const results = [];
let failed = false;

for (const c of cases) {
  const gate = assessProductionSecretsCutover(c.status(), c.migration());
  const ok = gate.status === c.expected;
  if (!ok) failed = true;
  results.push({
    id: c.id,
    expected: c.expected,
    actual: gate.status,
    ok,
    evidence: gate.evidence
  });
}

const report = {
  status: failed ? "FAIL_CLOSED" : "PASS",
  note: "Synthetic COMPLETE ≠ live production_secrets_cutover COMPLETE. Real ops docs must stay OPEN until authorized dated live evidence.",
  gate_id: "production_secrets_cutover",
  results
};

console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
