#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { evaluateControlEvidence } from "./verify-control-evidence.mjs";

function assertString(value, label, pattern = null) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  if (pattern && !pattern.test(value)) throw new Error(`${label} has invalid format`);
}

function verifyArtifact(artifact, label, evidenceDir) {
  if (!artifact || typeof artifact !== "object") throw new Error(`${label} artifact is required`);
  assertString(artifact.path, `${label} path`);
  if (path.isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).includes("..")) {
    throw new Error(`${label} artifact path must remain inside evidence directory`);
  }
  const file = path.resolve(evidenceDir, artifact.path);
  if (!fs.existsSync(file)) throw new Error(`${label} artifact does not exist`);
  const bytes = fs.readFileSync(file);
  if (!Number.isInteger(artifact.bytes) || bytes.length !== artifact.bytes) {
    throw new Error(`${label} byte count mismatch`);
  }
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  if (digest !== artifact.sha256) throw new Error(`${label} digest mismatch`);
  return { path: artifact.path, sha256: digest, bytes: bytes.length };
}

function validateObservation(observation) {
  if (observation.schema !== "grasshopper.rfb-observation/v1") throw new Error("unsupported observation schema");
  assertString(observation.contract_id, "contract_id");
  assertString(observation.captured_utc, "captured_utc");
  if (!Number.isFinite(Date.parse(observation.captured_utc))) throw new Error("captured_utc must be a date-time");
  if (!["LIVE", "TEST_FIXTURE"].includes(observation.collection_mode)) throw new Error("invalid collection_mode");
  if (!observation.source || typeof observation.source !== "object") throw new Error("source is required");
  assertString(observation.source.source_sha, "source_sha", /^[a-f0-9]{40}$/);
  assertString(observation.source.node_identity, "node_identity");
  if (observation.source.transport !== "RFB") throw new Error("transport must be RFB");
  if (observation.source.control_origin !== "workstation") throw new Error("control_origin must be workstation");
  assertString(observation.source.session_id, "session_id");
  if (!Number.isInteger(observation.observed_sequence) || observation.observed_sequence < 0) {
    throw new Error("observed_sequence must be a non-negative integer");
  }
  assertString(observation.observed_operation_id, "observed_operation_id");
  if (observation.input_observed_only !== true) throw new Error("input_observed_only must be true");
}

export function adaptRfbObservation(observation, evidenceDir) {
  validateObservation(observation);
  const before = verifyArtifact(observation.before_frame, "before frame", evidenceDir);
  const after = verifyArtifact(observation.after_frame, "after frame", evidenceDir);
  const changed = before.sha256 !== after.sha256;
  const evidence = {
    schema: "grasshopper.android-control-evidence/v1",
    contract_id: observation.contract_id,
    captured_utc: observation.captured_utc,
    collection_mode: observation.collection_mode,
    source: { ...observation.source },
    delivery: {
      status: "NOT_PROVEN",
      sequence: observation.observed_sequence,
      operation_id: observation.observed_operation_id,
      dispatch_disposition: "NOT_PROVEN",
      artifact: null,
    },
    visible_acknowledgement: {
      status: changed ? "PASS" : "NOT_PROVEN",
      ack_for_sequence: observation.observed_sequence,
      before_frame: changed ? before : null,
      after_frame: changed ? after : null,
    },
    semantic_effect: {
      status: "NOT_PROVEN",
      ack_for_sequence: observation.observed_sequence,
      expected: "",
      observed: "",
      artifact: null,
    },
    reconnect_continuity: {
      status: "NOT_PROVEN",
      session_id_before: observation.source.session_id,
      session_id_after: observation.source.session_id,
      sequence_before: observation.observed_sequence,
      sequence_after: observation.observed_sequence,
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
    console.error("usage: node scripts/cloud-android/adapt-rfb-observation.mjs OBSERVATION.json CONTROL_EVIDENCE.json");
    return 64;
  }
  try {
    const inputFile = path.resolve(argv[0]);
    const outputFile = path.resolve(argv[1]);
    if (path.dirname(inputFile) !== path.dirname(outputFile)) {
      throw new Error("input and output must share one evidence directory");
    }
    const observation = JSON.parse(fs.readFileSync(inputFile, "utf8"));
    const evidence = adaptRfbObservation(observation, path.dirname(inputFile));
    const descriptor = fs.openSync(outputFile, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(evidence, null, 2)}\n`);
    } finally {
      fs.closeSync(descriptor);
    }
    process.stdout.write(`${JSON.stringify({ status: "NOT_PROVEN", output: outputFile, r2: "NOT_PROVEN" })}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL rfb_observation_adapter ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
