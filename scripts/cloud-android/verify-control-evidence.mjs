#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateJsonSchemaSubset } from "../validate-json-schema-subset.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const schemaFile = path.join(root, "schemas/grasshopper-android-control-evidence-v1.schema.json");

function requireArtifact(artifact, label, evidenceDir) {
  if (!artifact) throw new Error(`${label} artifact is required for PASS`);
  if (path.isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).includes("..")) {
    throw new Error(`${label} artifact path must remain inside evidence directory`);
  }
  const file = path.resolve(evidenceDir, artifact.path);
  if (!fs.existsSync(file)) throw new Error(`${label} artifact does not exist`);
  const bytes = fs.readFileSync(file);
  if (bytes.length !== artifact.bytes) throw new Error(`${label} artifact byte count mismatch`);
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  if (digest !== artifact.sha256) throw new Error(`${label} artifact digest mismatch`);
}

function verifyPassGates(evidence, evidenceDir) {
  const sequence = evidence.delivery.sequence;
  if (evidence.delivery.status === "PASS") {
    if (evidence.delivery.dispatch_disposition !== "ORIGINAL_DISPATCH") {
      throw new Error("delivery PASS requires ORIGINAL_DISPATCH");
    }
    requireArtifact(evidence.delivery.artifact, "delivery", evidenceDir);
  }
  if (evidence.visible_acknowledgement.status === "PASS") {
    if (evidence.visible_acknowledgement.ack_for_sequence !== sequence) {
      throw new Error("visible acknowledgement sequence mismatch");
    }
    requireArtifact(evidence.visible_acknowledgement.before_frame, "before frame", evidenceDir);
    requireArtifact(evidence.visible_acknowledgement.after_frame, "after frame", evidenceDir);
    if (evidence.visible_acknowledgement.before_frame.sha256 === evidence.visible_acknowledgement.after_frame.sha256) {
      throw new Error("visible acknowledgement requires changed frame digest");
    }
  }
  if (evidence.semantic_effect.status === "PASS") {
    if (evidence.semantic_effect.ack_for_sequence !== sequence) throw new Error("semantic effect sequence mismatch");
    if (!evidence.semantic_effect.expected.trim() || !evidence.semantic_effect.observed.trim()) {
      throw new Error("semantic effect PASS requires expected and observed state");
    }
    requireArtifact(evidence.semantic_effect.artifact, "semantic effect", evidenceDir);
  }
  if (evidence.reconnect_continuity.status === "PASS") {
    const reconnect = evidence.reconnect_continuity;
    if (reconnect.session_id_before !== evidence.source.session_id || reconnect.session_id_after !== reconnect.session_id_before) {
      throw new Error("reconnect session identity changed");
    }
    if (reconnect.sequence_after <= reconnect.sequence_before) throw new Error("reconnect sequence did not advance");
    if (reconnect.client_disconnect_only !== true || reconnect.guest_restarted !== false) {
      throw new Error("reconnect PASS requires client-only disconnect without guest restart");
    }
    requireArtifact(reconnect.artifact, "reconnect", evidenceDir);
  }
}

export function evaluateControlEvidence(evidence, evidenceDir) {
  const schema = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
  const schemaErrors = validateJsonSchemaSubset(schema, evidence);
  if (schemaErrors.length) throw new Error(`schema invalid: ${schemaErrors.join("; ")}`);
  verifyPassGates(evidence, evidenceDir);
  const gates = {
    delivery: evidence.delivery.status,
    visible_acknowledgement: evidence.visible_acknowledgement.status,
    semantic_effect: evidence.semantic_effect.status,
    reconnect_continuity: evidence.reconnect_continuity.status,
  };
  const statuses = Object.values(gates);
  const overallStatus = statuses.includes("FAIL")
    ? "FAIL"
    : evidence.collection_mode === "LIVE" && statuses.every((status) => status === "PASS")
      ? "PASS"
      : "NOT_PROVEN";
  if (evidence.declared_status !== overallStatus) throw new Error("declared status does not match evaluated status");
  if (evidence.r2 !== "NOT_PROVEN") throw new Error("control evidence cannot independently close R2");
  return {
    schema: "grasshopper.android-control-evidence-evaluation/v1",
    collection_mode: evidence.collection_mode,
    overall_status: overallStatus,
    live_acceptance: overallStatus === "PASS" && evidence.collection_mode === "LIVE",
    gates,
    r2: "NOT_PROVEN",
  };
}

function main(argv) {
  if (argv.length !== 1) {
    console.error("usage: node scripts/cloud-android/verify-control-evidence.mjs EVIDENCE.json");
    return 64;
  }
  try {
    const file = path.resolve(argv[0]);
    const evidence = JSON.parse(fs.readFileSync(file, "utf8"));
    const report = evaluateControlEvidence(evidence, path.dirname(file));
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL android_control_evidence ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
