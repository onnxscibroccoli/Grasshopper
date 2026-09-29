import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateBistEvidence, validateBistReport } from "../scripts/validate-bist-schema.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function load(rel) {
  return JSON.parse(readFileSync(join(root, rel), "utf8"));
}

test("valid BIST report fixture matches omnikali-bist/v1", () => {
  const report = load("schemas/examples/bist-report.valid.json");
  assert.deepEqual(validateBistReport(report), []);
  assert.equal(report.schema, "omnikali-bist/v1");
});

test("valid evidence fixture requires acceptanceId", () => {
  const evidence = load("schemas/examples/bist-evidence.valid.json");
  assert.deepEqual(validateBistEvidence(evidence), []);
});

test("report rejects unknown status and mismatched summary", () => {
  const report = load("schemas/examples/bist-report.valid.json");
  report.checks[0].status = "HEALTHY";
  const errors = validateBistReport(report);
  assert.ok(errors.some((e) => e.includes("/checks/0/status")));
});

test("evidence without acceptanceId is invalid", () => {
  const errors = validateBistEvidence({ checks: { "production.database": { status: "PASS" } } });
  assert.ok(errors.some((e) => e.includes("/acceptanceId")));
});

test("JSON Schema files are parseable objects with expected $id", () => {
  const reportSchema = load("schemas/omnikali-bist-v1.schema.json");
  const evidenceSchema = load("schemas/omnikali-bist-evidence-v1.schema.json");
  assert.equal(reportSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(reportSchema.properties.schema.const, "omnikali-bist/v1");
  assert.deepEqual(reportSchema.$defs.status.enum, ["PASS", "FAIL", "NOT_PROVEN", "NOT_APPLICABLE"]);
  assert.equal(evidenceSchema.required.includes("acceptanceId"), true);
});
