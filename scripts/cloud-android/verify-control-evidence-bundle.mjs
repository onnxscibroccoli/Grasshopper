#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateJsonSchemaSubset } from "../validate-json-schema-subset.mjs";
import { evaluateControlEvidence } from "./verify-control-evidence.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const schemaFile = path.join(root, "schemas/grasshopper-android-control-evidence-bundle-v1.schema.json");
const requiredOrigins = ["workstation", "browser", "physical_android"];

function readBoundArtifact(artifact, bundleDir, label) {
  if (path.isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).includes("..")) {
    throw new Error(`${label} artifact path must remain inside bundle directory`);
  }
  const file = path.resolve(bundleDir, artifact.path);
  if (!fs.existsSync(file)) throw new Error(`${label} artifact does not exist`);
  const bytes = fs.readFileSync(file);
  if (bytes.length !== artifact.bytes) throw new Error(`${label} artifact byte count mismatch`);
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  if (digest !== artifact.sha256) throw new Error(`${label} artifact digest mismatch`);
  return { file, bytes };
}

export function evaluateControlEvidenceBundle(bundle, bundleDir) {
  const schema = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
  const schemaErrors = validateJsonSchemaSubset(schema, bundle);
  if (schemaErrors.length) throw new Error(`schema invalid: ${schemaErrors.join("; ")}`);

  const origins = bundle.entries.map((entry) => entry.origin);
  if (new Set(origins).size !== origins.length) throw new Error("duplicate origin in evidence bundle");
  if (origins.length !== requiredOrigins.length || requiredOrigins.some((origin) => !origins.includes(origin))) {
    throw new Error("evidence bundle requires exactly workstation, browser, and physical_android");
  }

  const reports = {};
  for (const entry of bundle.entries) {
    const { file, bytes } = readBoundArtifact(entry.artifact, bundleDir, entry.origin);
    let evidence;
    try { evidence = JSON.parse(bytes.toString("utf8")); } catch { throw new Error(`${entry.origin} artifact is not JSON`); }
    if (evidence.source.control_origin !== entry.origin) throw new Error(`${entry.origin} origin mismatch`);
    if (evidence.source.transport !== entry.transport) throw new Error(`${entry.origin} transport mismatch`);
    if (evidence.source.node_identity !== entry.node_identity) throw new Error(`${entry.origin} node identity mismatch`);
    if (evidence.source.source_sha !== bundle.binding.source_sha) throw new Error(`${entry.origin} source SHA mismatch`);
    if (entry.session_id !== bundle.binding.session_id || evidence.source.session_id !== bundle.binding.session_id) {
      throw new Error(`${entry.origin} session mismatch`);
    }
    if (evidence.collection_mode !== bundle.collection_mode) throw new Error(`${entry.origin} collection mode mismatch`);
    const evaluation = evaluateControlEvidence(evidence, path.dirname(file));
    reports[entry.origin] = {
      node_identity: entry.node_identity,
      transport: entry.transport,
      session_id: entry.session_id,
      evidence_sha256: entry.artifact.sha256,
      overall_status: evaluation.overall_status,
      gates: evaluation.gates,
    };
  }

  if (bundle.declared_status !== "NOT_PROVEN" || bundle.live_acceptance !== false || bundle.r2 !== "NOT_PROVEN") {
    throw new Error("bundle may not upgrade control status, claim live acceptance, or close R2");
  }
  return {
    schema: "grasshopper.android-control-evidence-bundle-evaluation/v1",
    collection_mode: bundle.collection_mode,
    binding: bundle.binding,
    origins: reports,
    overall_status: "NOT_PROVEN",
    live_acceptance: false,
    r2: "NOT_PROVEN",
  };
}

function main(argv) {
  if (argv.length !== 1) {
    console.error("usage: node scripts/cloud-android/verify-control-evidence-bundle.mjs BUNDLE.json");
    return 64;
  }
  try {
    const file = path.resolve(argv[0]);
    const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
    process.stdout.write(`${JSON.stringify(evaluateControlEvidenceBundle(bundle, path.dirname(file)))}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL android_control_evidence_bundle ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
