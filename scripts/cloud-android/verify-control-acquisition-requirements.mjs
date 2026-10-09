#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validateJsonSchemaSubset } from "../validate-json-schema-subset.mjs";
import { buildControlGapReport } from "./report-control-evidence-gaps.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const schemaFile = path.join(root, "schemas/grasshopper-android-control-acquisition-requirements-v1.schema.json");
const requiredOrigins = ["workstation", "browser", "physical_android"];
const minute = 60 * 1000;

function readJson(file, label) {
  const bytes = fs.readFileSync(file);
  try { return { value: JSON.parse(bytes.toString("utf8")), bytes }; }
  catch { throw new Error(`${label} is not JSON`); }
}

function milliseconds(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid timestamp`);
  return parsed;
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function verifyControlAcquisitionRequirements(requirements, gap, bundle, bundleDir, gapBytes, bundleBytes, evaluatedAt) {
  const schema = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
  const errors = validateJsonSchemaSubset(schema, requirements);
  if (errors.length) throw new Error(`schema invalid: ${errors.join("; ")}`);

  if (requirements.gap_report.bytes !== gapBytes.length) throw new Error("gap report byte count mismatch");
  const gapDigest = crypto.createHash("sha256").update(gapBytes).digest("hex");
  if (requirements.gap_report.sha256 !== gapDigest) throw new Error("gap report digest mismatch");

  const expectedGap = buildControlGapReport(bundle, bundleDir, {
    sha256: crypto.createHash("sha256").update(bundleBytes).digest("hex"),
    bytes: bundleBytes.length,
  });
  if (!isDeepStrictEqual(gap, expectedGap)) throw new Error("gap report does not match verified bundle");
  if (!isDeepStrictEqual(requirements.binding, gap.binding)) throw new Error("source/session binding mismatch");
  if (requirements.collection_mode !== gap.collection_mode) throw new Error("collection mode mismatch");

  const origins = requirements.origins.map((entry) => entry.origin);
  if (new Set(origins).size !== origins.length || requiredOrigins.some((origin) => !origins.includes(origin))) {
    throw new Error("requirements need exactly one entry per origin");
  }
  for (const entry of requirements.origins) {
    const expected = gap.origins[entry.origin];
    if (entry.node_identity !== expected.node_identity) throw new Error(`${entry.origin} node identity mismatch`);
    if (entry.transport !== expected.transport) throw new Error(`${entry.origin} transport mismatch`);
    if (entry.session_id !== expected.session_id) throw new Error(`${entry.origin} session mismatch`);
    if (entry.evidence_sha256 !== expected.evidence_sha256) throw new Error(`${entry.origin} evidence digest mismatch`);
    if (!sameArray(entry.required_gates, expected.missing_gates)) throw new Error(`${entry.origin} required gates mismatch`);
  }

  const started = milliseconds(requirements.guest_process.started_utc, "process start");
  const observed = milliseconds(requirements.guest_process.observed_utc, "process observation");
  const issued = milliseconds(requirements.issued_utc, "issue time");
  const expires = milliseconds(requirements.expires_utc, "expiry");
  const at = milliseconds(evaluatedAt, "evaluation time");
  if (started > observed) throw new Error("process start must not follow observation");
  if (observed > issued) throw new Error("process observation must not follow issue time");
  if (issued - observed > 5 * minute) throw new Error("process observation is older than 5 minutes at issue time");
  if (expires <= issued) throw new Error("expiry must follow issue time");
  if (expires - observed > 20 * minute) throw new Error("validity exceeds 20 minutes from process observation");
  if (at < issued) throw new Error("requirements are not yet valid");
  if (at > expires) throw new Error("requirements expired");

  return {
    schema: "grasshopper.android-control-acquisition-requirements-evaluation/v1",
    requirements_status: "VALID_NON_EXECUTABLE",
    evaluated_at: evaluatedAt,
    binding: requirements.binding,
    guest_process: requirements.guest_process,
    origins: Object.fromEntries(requirements.origins.map((entry) => [entry.origin, { required_gates: entry.required_gates }])),
    collection_authorized: false,
    live_acceptance: false,
    r2: "NOT_PROVEN",
  };
}

function main(argv) {
  if (argv.length !== 5 || argv[3] !== "--at") {
    console.error("usage: node scripts/cloud-android/verify-control-acquisition-requirements.mjs REQUIREMENTS.json GAP_REPORT.json BUNDLE.json --at ISO_UTC");
    return 64;
  }
  try {
    const requirementsFile = path.resolve(argv[0]);
    const gapFile = path.resolve(argv[1]);
    const bundleFile = path.resolve(argv[2]);
    const requirements = readJson(requirementsFile, "requirements");
    const gap = readJson(gapFile, "gap report");
    const bundle = readJson(bundleFile, "bundle");
    if (requirements.value.gap_report?.path !== path.basename(gapFile)) throw new Error("gap report path mismatch");
    const result = verifyControlAcquisitionRequirements(requirements.value, gap.value, bundle.value, path.dirname(bundleFile), gap.bytes, bundle.bytes, argv[4]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL android_control_acquisition_requirements ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
