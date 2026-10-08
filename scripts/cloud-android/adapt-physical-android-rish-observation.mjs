#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { evaluateControlEvidence } from "./verify-control-evidence.mjs";

const SHA1 = /^[a-f0-9]{40}$/;

function assertString(value, label, pattern = null) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  if (pattern && !pattern.test(value)) throw new Error(`${label} has invalid format`);
}

function assertDateTime(value, label) {
  assertString(value, label);
  if (!Number.isFinite(Date.parse(value))) throw new Error(`${label} must be a date-time`);
}

function readArtifact(artifact, label, evidenceDir) {
  if (!artifact || typeof artifact !== "object") throw new Error(`${label} artifact is required`);
  assertString(artifact.path, `${label} path`);
  if (path.isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).includes("..")) {
    throw new Error(`${label} artifact path must remain inside evidence directory`);
  }
  const bytes = fs.readFileSync(path.resolve(evidenceDir, artifact.path));
  if (!Number.isInteger(artifact.bytes) || bytes.length !== artifact.bytes) throw new Error(`${label} byte count mismatch`);
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== artifact.sha256) throw new Error(`${label} digest mismatch`);
  return { bytes, sha256 };
}

function validateObservation(observation) {
  if (observation.schema !== "grasshopper.physical-android-rish-observation/v1") {
    throw new Error("unsupported observation schema");
  }
  assertString(observation.contract_id, "contract_id");
  assertDateTime(observation.captured_utc, "captured_utc");
  if (!["LIVE", "TEST_FIXTURE"].includes(observation.collection_mode)) throw new Error("invalid collection_mode");
  if (!observation.source || typeof observation.source !== "object") throw new Error("source is required");
  assertString(observation.source.source_sha, "source_sha", SHA1);
  assertString(observation.source.node_identity, "node_identity");
  if (observation.source.transport !== "broccoli-rish") throw new Error("transport must be broccoli-rish");
  if (observation.source.control_origin !== "physical_android") throw new Error("control_origin must be physical_android");
  assertString(observation.source.session_id, "session_id");
  if (observation.observation_only !== true) throw new Error("observation_only must be true");
}

function validateRecord(record, source) {
  if (record.schema !== "grasshopper.broccoli-rish-record/v1") throw new Error("unsupported Rish record schema");
  assertString(record.source_sha, "record source_sha", SHA1);
  assertString(record.node_identity, "record node_identity");
  assertString(record.transport, "record transport");
  assertString(record.session_id, "record session_id");
  if (record.source_sha !== source.source_sha || record.node_identity !== source.node_identity ||
      record.transport !== source.transport || record.session_id !== source.session_id) {
    throw new Error("record identity does not match observation source");
  }
  if (!Number.isInteger(record.sequence) || record.sequence < 0) throw new Error("record sequence must be non-negative");
  assertDateTime(record.captured_utc, "record captured_utc");
  if (!record.wrapper || typeof record.wrapper !== "object") throw new Error("wrapper provenance is required");
  if (record.wrapper.repository !== "onnxscibroccoli/broccoli-core" || record.wrapper.path !== "lib/rish_run.sh") {
    throw new Error("canonical wrapper must be onnxscibroccoli/broccoli-core:lib/rish_run.sh");
  }
  assertString(record.wrapper.commit_sha, "wrapper commit_sha", SHA1);
  assertString(record.wrapper.blob_sha, "wrapper blob_sha", SHA1);
  if (record.wrapper.rish_preserve_env !== "0") throw new Error("RISH_PRESERVE_ENV must equal 0");
  if (!record.execution || typeof record.execution !== "object") throw new Error("execution evidence is required");
  if (record.execution.disposition !== "OBSERVED_ONLY") throw new Error("Rish execution disposition must be OBSERVED_ONLY");
  if (record.execution.exit_code !== 0 || record.execution.uid !== 2000 || record.execution.selinux_context !== "u:r:shell:s0") {
    throw new Error("Rish evidence requires a successful uid=2000 shell boundary");
  }
  if (record.execution.device_model !== record.node_identity) throw new Error("device model does not match node identity");
}

export function adaptPhysicalAndroidRishObservation(observation, evidenceDir) {
  validateObservation(observation);
  const artifact = readArtifact(observation.rish_record, "Rish record", evidenceDir);
  let record;
  try {
    record = JSON.parse(artifact.bytes.toString("utf8"));
  } catch {
    throw new Error("Rish record must be valid JSON");
  }
  validateRecord(record, observation.source);
  const evidence = {
    schema: "grasshopper.android-control-evidence/v1",
    contract_id: observation.contract_id,
    captured_utc: observation.captured_utc,
    collection_mode: observation.collection_mode,
    source: { ...observation.source },
    delivery: {
      status: "NOT_PROVEN",
      sequence: record.sequence,
      operation_id: `observed-broccoli-rish-${artifact.sha256}`,
      dispatch_disposition: "NOT_PROVEN",
      artifact: null,
    },
    visible_acknowledgement: {
      status: "NOT_PROVEN",
      ack_for_sequence: record.sequence,
      before_frame: null,
      after_frame: null,
    },
    semantic_effect: {
      status: "NOT_PROVEN",
      ack_for_sequence: record.sequence,
      expected: "",
      observed: "",
      artifact: null,
    },
    reconnect_continuity: {
      status: "NOT_PROVEN",
      session_id_before: record.session_id,
      session_id_after: record.session_id,
      sequence_before: record.sequence,
      sequence_after: record.sequence,
      client_disconnect_only: false,
      guest_restarted: false,
      artifact: null,
    },
    declared_status: "NOT_PROVEN",
    r2: "NOT_PROVEN",
  };
  evaluateControlEvidence(evidence, evidenceDir);
  return evidence;
}

function main(argv) {
  if (argv.length !== 2) {
    console.error("usage: node scripts/cloud-android/adapt-physical-android-rish-observation.mjs OBSERVATION.json CONTROL_EVIDENCE.json");
    return 64;
  }
  try {
    const inputFile = path.resolve(argv[0]);
    const outputFile = path.resolve(argv[1]);
    if (path.dirname(inputFile) !== path.dirname(outputFile)) throw new Error("input and output must share one evidence directory");
    const observation = JSON.parse(fs.readFileSync(inputFile, "utf8"));
    const evidence = adaptPhysicalAndroidRishObservation(observation, path.dirname(inputFile));
    const descriptor = fs.openSync(outputFile, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(evidence, null, 2)}\n`);
    } finally {
      fs.closeSync(descriptor);
    }
    process.stdout.write(`${JSON.stringify({ status: "NOT_PROVEN", output: outputFile, r2: "NOT_PROVEN" })}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL physical_android_rish_observation_adapter ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
