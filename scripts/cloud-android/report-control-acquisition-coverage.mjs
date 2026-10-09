#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { verifyControlAcquisitionReceipt } from "./verify-control-acquisition-receipt.mjs";

function readJson(file, label) {
  const bytes = fs.readFileSync(file);
  try { return { value: JSON.parse(bytes.toString("utf8")), bytes }; }
  catch { throw new Error(`${label} is not JSON`); }
}

export function buildControlAcquisitionCoverage(receipt, requirements, requirementsBytes, gap, gapBytes, bundle, bundleBytes, receiptDir, bundleDir, evaluatedAt) {
  verifyControlAcquisitionReceipt(
    receipt,
    requirements,
    requirementsBytes,
    gap,
    gapBytes,
    bundle,
    bundleBytes,
    receiptDir,
    bundleDir,
    evaluatedAt,
  );

  const origins = {};
  let complete = true;
  for (const expected of requirements.origins) {
    const received = receipt.origins.find((entry) => entry.origin === expected.origin);
    const artifactBoundGates = received.entries.map((entry) => entry.gate);
    const bound = new Set(artifactBoundGates);
    const stillUncollected = expected.required_gates.filter((gate) => !bound.has(gate));
    if (stillUncollected.length) complete = false;
    origins[expected.origin] = {
      node_identity: received.node_identity,
      transport: received.transport,
      session_id: received.session_id,
      requested_gates: expected.required_gates,
      artifact_bound_gates: artifactBoundGates,
      still_uncollected_gates: stillUncollected,
      gate_states: Object.fromEntries(expected.required_gates.map((gate) => [
        gate,
        bound.has(gate) ? "ARTIFACT_BOUND_NOT_ACCEPTANCE" : "NOT_COLLECTED",
      ])),
      artifacts: Object.fromEntries(received.entries.map((entry) => [entry.gate, entry.artifact])),
    };
  }

  return {
    schema: "grasshopper.android-control-acquisition-coverage/v1",
    contract_id: receipt.contract_id,
    collection_mode: receipt.collection_mode,
    evaluated_at: evaluatedAt,
    requirements: receipt.requirements,
    binding: receipt.binding,
    guest_process: receipt.guest_process,
    origins,
    coverage_status: complete
      ? "COMPLETE_ARTIFACT_BINDING_NOT_ACCEPTANCE"
      : "INCOMPLETE_ARTIFACT_BINDING",
    cross_origin_equivalence: "NOT_INFERRED",
    reporter_dispatches_or_connects: false,
    overall_status: "NOT_PROVEN",
    live_acceptance: false,
    r2: "NOT_PROVEN",
  };
}

function main(argv) {
  if (argv.length !== 6 || argv[4] !== "--at") {
    console.error("usage: node scripts/cloud-android/report-control-acquisition-coverage.mjs RECEIPT.json REQUIREMENTS.json GAP_REPORT.json BUNDLE.json --at ISO_UTC");
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
    const report = buildControlAcquisitionCoverage(
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
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL android_control_acquisition_coverage ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
