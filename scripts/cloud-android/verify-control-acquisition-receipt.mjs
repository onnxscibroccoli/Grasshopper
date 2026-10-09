#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validateJsonSchemaSubset } from "../validate-json-schema-subset.mjs";
import { verifyControlAcquisitionRequirements } from "./verify-control-acquisition-requirements.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const schemaFile = path.join(root, "schemas/grasshopper-android-control-acquisition-receipt-v1.schema.json");
const requiredOrigins = ["workstation", "browser", "physical_android"];

function readJson(file, label) {
  const bytes = fs.readFileSync(file);
  try { return { value: JSON.parse(bytes.toString("utf8")), bytes }; }
  catch { throw new Error(`${label} is not JSON`); }
}

function digest(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function timestamp(value, label) {
  const result = Date.parse(value);
  if (!Number.isFinite(result)) throw new Error(`${label} is not a valid timestamp`);
  return result;
}

function requireBoundArtifact(artifact, label, receiptDir) {
  if (path.isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).includes("..")) {
    throw new Error(`${label} artifact path must remain inside receipt directory`);
  }
  const file = path.resolve(receiptDir, artifact.path);
  if (!fs.existsSync(file)) throw new Error(`${label} artifact does not exist`);
  const bytes = fs.readFileSync(file);
  if (bytes.length !== artifact.bytes) throw new Error(`${label} artifact byte count mismatch`);
  if (digest(bytes) !== artifact.sha256) throw new Error(`${label} artifact digest mismatch`);
}

export function verifyControlAcquisitionReceipt(receipt, requirements, requirementsBytes, gap, gapBytes, bundle, bundleBytes, receiptDir, bundleDir, evaluatedAt) {
  const schema = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
  const errors = validateJsonSchemaSubset(schema, receipt);
  if (errors.length) throw new Error(`schema invalid: ${errors.join("; ")}`);

  if (receipt.requirements.bytes !== requirementsBytes.length) throw new Error("requirements byte count mismatch");
  if (receipt.requirements.sha256 !== digest(requirementsBytes)) throw new Error("requirements digest mismatch");

  verifyControlAcquisitionRequirements(
    requirements,
    gap,
    bundle,
    bundleDir,
    gapBytes,
    bundleBytes,
    evaluatedAt,
  );

  if (receipt.collection_mode !== requirements.collection_mode) throw new Error("collection mode mismatch");
  if (!isDeepStrictEqual(receipt.binding, requirements.binding)) throw new Error("source/session binding mismatch");
  if (!isDeepStrictEqual(receipt.guest_process, requirements.guest_process)) throw new Error("guest process mismatch");

  const collected = timestamp(receipt.collected_utc, "collection time");
  const issued = timestamp(requirements.issued_utc, "requirements issue time");
  const expires = timestamp(requirements.expires_utc, "requirements expiry");
  const evaluated = timestamp(evaluatedAt, "evaluation time");
  const observed = timestamp(requirements.guest_process.observed_utc, "process observation");
  if (collected < issued) throw new Error("collection predates requirements");
  if (collected > expires) throw new Error("collection occurred after requirements expiry");
  if (collected > evaluated) throw new Error("collection time is in the future");
  if (collected < observed) throw new Error("collection predates process observation");

  const origins = receipt.origins.map((entry) => entry.origin);
  if (new Set(origins).size !== origins.length || requiredOrigins.some((origin) => !origins.includes(origin))) {
    throw new Error("receipt needs exactly one entry per origin");
  }

  const resultOrigins = {};
  for (const origin of receipt.origins) {
    const expected = requirements.origins.find((entry) => entry.origin === origin.origin);
    if (origin.node_identity !== expected.node_identity) throw new Error(`${origin.origin} node identity mismatch`);
    if (origin.transport !== expected.transport) throw new Error(`${origin.origin} transport mismatch`);
    if (origin.session_id !== expected.session_id) throw new Error(`${origin.origin} session mismatch`);
    const seen = new Set();
    resultOrigins[origin.origin] = {};
    for (const entry of origin.entries) {
      if (seen.has(entry.gate)) throw new Error(`duplicate ${origin.origin} gate ${entry.gate}`);
      seen.add(entry.gate);
      if (!expected.required_gates.includes(entry.gate)) {
        throw new Error(`${origin.origin} gate ${entry.gate} was not requested`);
      }
      requireBoundArtifact(entry.artifact, `${origin.origin} ${entry.gate}`, receiptDir);
      resultOrigins[origin.origin][entry.gate] = "ARTIFACT_BOUND";
    }
  }

  return {
    schema: "grasshopper.android-control-acquisition-receipt-evaluation/v1",
    receipt_status: "VALID_ARTIFACT_BINDING_NOT_ACCEPTANCE",
    evaluated_at: evaluatedAt,
    binding: receipt.binding,
    guest_process: receipt.guest_process,
    origins: resultOrigins,
    verifier_dispatches_or_connects: false,
    live_acceptance: false,
    r2: "NOT_PROVEN",
  };
}

function main(argv) {
  if (argv.length !== 6 || argv[4] !== "--at") {
    console.error("usage: node scripts/cloud-android/verify-control-acquisition-receipt.mjs RECEIPT.json REQUIREMENTS.json GAP_REPORT.json BUNDLE.json --at ISO_UTC");
    return 64;
  }
  try {
    const receiptFile = path.resolve(argv[0]);
    const requirementsFile = path.resolve(argv[1]);
    const gapFile = path.resolve(argv[2]);
    const bundleFile = path.resolve(argv[3]);
    const receipt = readJson(receiptFile, "receipt");
    const requirements = readJson(requirementsFile, "requirements");
    const gap = readJson(gapFile, "gap report");
    const bundle = readJson(bundleFile, "bundle");
    if (receipt.value.requirements?.path !== path.basename(requirementsFile)) throw new Error("requirements path mismatch");
    if (requirements.value.gap_report?.path !== path.basename(gapFile)) throw new Error("gap report path mismatch");
    const result = verifyControlAcquisitionReceipt(
      receipt.value,
      requirements.value,
      requirements.bytes,
      gap.value,
      gap.bytes,
      bundle.value,
      bundle.bytes,
      path.dirname(receiptFile),
      path.dirname(bundleFile),
      argv[5],
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL android_control_acquisition_receipt ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
