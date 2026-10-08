#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { evaluateControlEvidence } from "./verify-control-evidence.mjs";

function assertString(value, label, pattern = null) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a non-empty string`);
  if (pattern && !pattern.test(value)) throw new Error(`${label} has invalid format`);
}

function readArtifact(artifact, label, evidenceDir) {
  if (!artifact || typeof artifact !== "object") throw new Error(`${label} artifact is required`);
  assertString(artifact.path, `${label} path`);
  if (path.isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).includes("..")) {
    throw new Error(`${label} artifact path must remain inside evidence directory`);
  }
  const bytes = fs.readFileSync(path.resolve(evidenceDir, artifact.path));
  if (!Number.isInteger(artifact.bytes) || bytes.length !== artifact.bytes) {
    throw new Error(`${label} byte count mismatch`);
  }
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== artifact.sha256) throw new Error(`${label} digest mismatch`);
  return { bytes, descriptor: { path: artifact.path, sha256, bytes: bytes.length } };
}

function assertDateTime(value, label) {
  assertString(value, label);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a date-time`);
  return parsed;
}

function validateObservation(observation) {
  if (observation.schema !== "grasshopper.browser-reconnect-observation/v1") {
    throw new Error("unsupported observation schema");
  }
  assertString(observation.contract_id, "contract_id");
  assertDateTime(observation.captured_utc, "captured_utc");
  if (!["LIVE", "TEST_FIXTURE"].includes(observation.collection_mode)) throw new Error("invalid collection_mode");
  if (!observation.source || typeof observation.source !== "object") throw new Error("source is required");
  assertString(observation.source.source_sha, "source_sha", /^[a-f0-9]{40}$/);
  assertString(observation.source.node_identity, "node_identity");
  assertString(observation.source.transport, "transport");
  if (observation.source.control_origin !== "browser") throw new Error("control_origin must be browser");
  assertString(observation.source.session_id, "session_id");
  if (observation.observation_only !== true) throw new Error("observation_only must be true");
}

function validateRecord(record, source) {
  if (record.schema !== "grasshopper.browser-reconnect-record/v1") throw new Error("unsupported reconnect record schema");
  assertString(record.source_sha, "record source_sha", /^[a-f0-9]{40}$/);
  assertString(record.node_identity, "record node_identity");
  assertString(record.transport, "record transport");
  assertString(record.session_id_before, "record session_id_before");
  assertString(record.session_id_after, "record session_id_after");
  if (record.source_sha !== source.source_sha || record.node_identity !== source.node_identity ||
      record.transport !== source.transport || record.session_id_before !== source.session_id) {
    throw new Error("record identity does not match observation source");
  }
  if (record.session_id_after !== record.session_id_before) throw new Error("reconnect session identity changed");
  if (!Number.isInteger(record.sequence_before) || record.sequence_before < 0 ||
      !Number.isInteger(record.sequence_after) || record.sequence_after <= record.sequence_before) {
    throw new Error("reconnect sequence did not advance");
  }
  if (record.client_disconnect_only !== true || record.guest_restarted !== false) {
    throw new Error("reconnect requires client-only disconnect without guest restart");
  }
  const disconnected = assertDateTime(record.disconnected_utc, "disconnected_utc");
  const reconnected = assertDateTime(record.reconnected_utc, "reconnected_utc");
  if (reconnected <= disconnected) throw new Error("reconnect timestamp did not advance");
}

export function adaptBrowserReconnectObservation(observation, evidenceDir) {
  validateObservation(observation);
  const artifact = readArtifact(observation.reconnect_record, "reconnect record", evidenceDir);
  let record;
  try {
    record = JSON.parse(artifact.bytes.toString("utf8"));
  } catch {
    throw new Error("reconnect record must be valid JSON");
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
      sequence: record.sequence_after,
      operation_id: `observed-browser-reconnect-${record.sequence_after}`,
      dispatch_disposition: "NOT_PROVEN",
      artifact: null,
    },
    visible_acknowledgement: {
      status: "NOT_PROVEN",
      ack_for_sequence: record.sequence_after,
      before_frame: null,
      after_frame: null,
    },
    semantic_effect: {
      status: "NOT_PROVEN",
      ack_for_sequence: record.sequence_after,
      expected: "",
      observed: "",
      artifact: null,
    },
    reconnect_continuity: {
      status: "PASS",
      session_id_before: record.session_id_before,
      session_id_after: record.session_id_after,
      sequence_before: record.sequence_before,
      sequence_after: record.sequence_after,
      client_disconnect_only: record.client_disconnect_only,
      guest_restarted: record.guest_restarted,
      artifact: artifact.descriptor,
    },
    declared_status: "NOT_PROVEN",
    r2: "NOT_PROVEN",
  };
  evaluateControlEvidence(evidence, evidenceDir);
  return evidence;
}

function main(argv) {
  if (argv.length !== 2) {
    console.error("usage: node scripts/cloud-android/adapt-browser-reconnect-observation.mjs OBSERVATION.json CONTROL_EVIDENCE.json");
    return 64;
  }
  try {
    const inputFile = path.resolve(argv[0]);
    const outputFile = path.resolve(argv[1]);
    if (path.dirname(inputFile) !== path.dirname(outputFile)) {
      throw new Error("input and output must share one evidence directory");
    }
    const observation = JSON.parse(fs.readFileSync(inputFile, "utf8"));
    const evidence = adaptBrowserReconnectObservation(observation, path.dirname(inputFile));
    const descriptor = fs.openSync(outputFile, "wx", 0o600);
    try {
      fs.writeFileSync(descriptor, `${JSON.stringify(evidence, null, 2)}\n`);
    } finally {
      fs.closeSync(descriptor);
    }
    process.stdout.write(`${JSON.stringify({ status: "NOT_PROVEN", output: outputFile, r2: "NOT_PROVEN" })}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL browser_reconnect_observation_adapter ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
