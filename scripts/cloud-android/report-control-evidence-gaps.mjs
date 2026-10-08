#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { evaluateControlEvidenceBundle } from "./verify-control-evidence-bundle.mjs";

const gateOrder = ["delivery", "visible_acknowledgement", "semantic_effect", "reconnect_continuity"];

export function buildControlGapReport(bundle, bundleDir, bundleArtifact) {
  const evaluation = evaluateControlEvidenceBundle(bundle, bundleDir);
  const origins = {};
  for (const [origin, source] of Object.entries(evaluation.origins)) {
    origins[origin] = {
      node_identity: source.node_identity,
      transport: source.transport,
      session_id: source.session_id,
      evidence_sha256: source.evidence_sha256,
      gate_statuses: source.gates,
      missing_gates: gateOrder.filter((gate) => source.gates[gate] !== "PASS"),
      status: "NOT_PROVEN",
    };
  }
  return {
    schema: "grasshopper.android-control-gap-report/v1",
    contract_id: bundle.contract_id,
    collection_mode: evaluation.collection_mode,
    bundle: bundleArtifact,
    binding: evaluation.binding,
    origins,
    cross_origin_equivalence: "NOT_INFERRED",
    overall_status: "NOT_PROVEN",
    live_acceptance: false,
    r2: "NOT_PROVEN",
  };
}

function main(argv) {
  if (argv.length !== 1) {
    console.error("usage: node scripts/cloud-android/report-control-evidence-gaps.mjs BUNDLE.json");
    return 64;
  }
  try {
    const file = path.resolve(argv[0]);
    const bytes = fs.readFileSync(file);
    const bundle = JSON.parse(bytes.toString("utf8"));
    const bundleArtifact = {
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    };
    process.stdout.write(`${JSON.stringify(buildControlGapReport(bundle, path.dirname(file), bundleArtifact))}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL android_control_gap_report ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
