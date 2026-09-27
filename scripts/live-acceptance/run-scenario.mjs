#!/usr/bin/env node
/**
 * Shared live-acceptance scenario runner (fail-closed scaffold).
 *
 * dry-run (default): load scenarios/<id>/scenario.mjs, call dryRun(), exit 1 if
 * missing/not_ok. NEVER writes COMPLETE to the evidence manifest.
 *
 * record: refuses unless --evidence, --run-at (ISO), and --operator are all
 * provided AND the scenario's liveRun/recordAcceptance returns ok. Stubs fail
 * closed. This scaffold does not call Helix or mutate production.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  REQUIRED_SCENARIO_IDS,
  REQUIRED_SCENARIO_LABELS,
  isKnownScenarioId
} from "./scenario-ids.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MANIFEST_REL = "reference/production/live-acceptance/manifest.json";
const MANIFEST_PATH = path.join(ROOT, MANIFEST_REL);
const SCENARIOS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "scenarios"
);

const ISO_DATE_RE =
  /^(20\d{2}-\d{2}-\d{2})(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function parseArgs(argv) {
  const out = {
    scenario: null,
    mode: "dry-run",
    json: false,
    evidence: null,
    runAt: null,
    operator: null,
    help: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--scenario") out.scenario = argv[++i] ?? null;
    else if (a === "--mode") out.mode = argv[++i] ?? "dry-run";
    else if (a === "--evidence") out.evidence = argv[++i] ?? null;
    else if (a === "--run-at") out.runAt = argv[++i] ?? null;
    else if (a === "--operator") out.operator = argv[++i] ?? null;
    else if (a.startsWith("--scenario=")) out.scenario = a.slice("--scenario=".length);
    else if (a.startsWith("--mode=")) out.mode = a.slice("--mode=".length);
    else if (a.startsWith("--evidence=")) out.evidence = a.slice("--evidence=".length);
    else if (a.startsWith("--run-at=")) out.runAt = a.slice("--run-at=".length);
    else if (a.startsWith("--operator=")) out.operator = a.slice("--operator=".length);
  }
  return out;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/live-acceptance/run-scenario.mjs --scenario <id> [--mode dry-run|record] [--json]",
    "  node scripts/live-acceptance/run-scenario.mjs --scenario <id> --mode record \\",
    "    --evidence <summary> --run-at <ISO> --operator <label> [--json]",
    "",
    `Known ids: ${REQUIRED_SCENARIO_IDS.join(", ")}`,
    "",
    "dry-run never writes COMPLETE. record refuses without flags and a scenario",
    "module that returns ok from liveRun/recordAcceptance (stubs fail closed)."
  ].join("\n");
}

function emit(payload, { json, ok }) {
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    const status = ok ? "ok" : "not_ok";
    console.log(`live-acceptance runner: ${status}`);
    if (payload.scenarioId) console.log(`scenario: ${payload.scenarioId}`);
    if (payload.mode) console.log(`mode: ${payload.mode}`);
    if (payload.error) console.log(`error: ${payload.error}`);
    if (payload.evidence) console.log(`evidence: ${payload.evidence}`);
    if (payload.details && typeof payload.details === "object") {
      for (const [k, v] of Object.entries(payload.details)) {
        console.log(`${k}: ${v}`);
      }
    }
  }
}

function scenarioModulePath(id) {
  return path.join(SCENARIOS_DIR, id, "scenario.mjs");
}

async function loadScenario(id) {
  const full = scenarioModulePath(id);
  if (!fs.existsSync(full)) {
    return {
      ok: false,
      error: `missing scenario module: scripts/live-acceptance/scenarios/${id}/scenario.mjs`
    };
  }
  try {
    const mod = await import(pathToFileURL(full).href);
    if (!mod || typeof mod.dryRun !== "function") {
      return {
        ok: false,
        error: `scenario module for ${id} does not export dryRun()`
      };
    }
    return { ok: true, mod, path: full };
  } catch (err) {
    return {
      ok: false,
      error: `failed to load scenario module for ${id}: ${err?.message || String(err)}`
    };
  }
}

function readManifestSnapshot() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  return fs.readFileSync(MANIFEST_PATH, "utf8");
}

function writeManifestComplete({ scenarioId, evidence, runAt, operator, label }) {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);
  if (!manifest.scenarios || typeof manifest.scenarios !== "object") {
    throw new Error("manifest missing scenarios map");
  }
  const prev = manifest.scenarios[scenarioId] || {};
  manifest.scenarios[scenarioId] = {
    ...prev,
    status: "COMPLETE",
    label: label || prev.label || REQUIRED_SCENARIO_LABELS[scenarioId] || scenarioId,
    critical: prev.critical !== undefined ? prev.critical : true,
    evidence,
    run_at: runAt,
    operator
  };
  manifest.generated_at = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function resolveRecordFn(mod) {
  if (typeof mod.liveRun === "function") return mod.liveRun.bind(mod);
  if (typeof mod.recordAcceptance === "function") {
    return mod.recordAcceptance.bind(mod);
  }
  return null;
}

async function runDryRun(args) {
  const id = args.scenario;
  const loaded = await loadScenario(id);
  if (!loaded.ok) {
    const payload = {
      ok: false,
      mode: "dry-run",
      scenarioId: id,
      error: loaded.error,
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    return 1;
  }

  let result;
  try {
    result = await loaded.mod.dryRun();
  } catch (err) {
    const payload = {
      ok: false,
      mode: "dry-run",
      scenarioId: id,
      error: `dryRun() threw: ${err?.message || String(err)}`,
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    return 1;
  }

  const ok = Boolean(result && result.ok === true);
  const payload = {
    ok,
    mode: "dry-run",
    scenarioId: id,
    label: loaded.mod.label || REQUIRED_SCENARIO_LABELS[id] || id,
    evidence:
      result && typeof result.evidence === "string"
        ? result.evidence
        : ok
          ? "dry-run ok"
          : "dry-run not ok",
    details: result?.details,
    manifest_mutated: false,
    note: "dry-run never writes COMPLETE to the evidence manifest"
  };
  emit(payload, { json: args.json, ok });
  return ok ? 0 : 1;
}

async function runRecord(args) {
  const id = args.scenario;
  const missing = [];
  if (!args.evidence || !String(args.evidence).trim()) missing.push("--evidence");
  if (!args.runAt || !String(args.runAt).trim()) missing.push("--run-at");
  if (!args.operator || !String(args.operator).trim()) missing.push("--operator");

  if (missing.length) {
    const payload = {
      ok: false,
      mode: "record",
      scenarioId: id,
      error: `record refused: missing required flags: ${missing.join(", ")}`,
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    return 1;
  }

  if (!ISO_DATE_RE.test(String(args.runAt).trim())) {
    const payload = {
      ok: false,
      mode: "record",
      scenarioId: id,
      error: `record refused: --run-at must be an ISO date or datetime (got ${JSON.stringify(args.runAt)})`,
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    return 1;
  }

  const before = readManifestSnapshot();
  const loaded = await loadScenario(id);
  if (!loaded.ok) {
    const payload = {
      ok: false,
      mode: "record",
      scenarioId: id,
      error: loaded.error,
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    return 1;
  }

  const recordFn = resolveRecordFn(loaded.mod);
  if (!recordFn) {
    const payload = {
      ok: false,
      mode: "record",
      scenarioId: id,
      error:
        "record refused: scenario module has no liveRun() or recordAcceptance(); stubs fail closed",
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    return 1;
  }

  const ctx = {
    evidence: String(args.evidence).trim(),
    runAt: String(args.runAt).trim(),
    operator: String(args.operator).trim(),
    scenarioId: id
  };

  let result;
  try {
    result = await recordFn(ctx);
  } catch (err) {
    const payload = {
      ok: false,
      mode: "record",
      scenarioId: id,
      error: `liveRun/recordAcceptance threw: ${err?.message || String(err)}`,
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    return 1;
  }

  if (!result || result.ok !== true) {
    const payload = {
      ok: false,
      mode: "record",
      scenarioId: id,
      evidence:
        result && typeof result.evidence === "string"
          ? result.evidence
          : "record path returned not_ok; manifest unchanged",
      details: result?.details,
      manifest_mutated: false,
      note: "fail-closed: stubs and unimplemented liveRun must not mark COMPLETE"
    };
    emit(payload, { json: args.json, ok: false });
    return 1;
  }

  // Conservative: only update manifest when record path explicitly ok.
  // This scaffold still refuses Helix; implementing scenarios must not invent dates.
  try {
    writeManifestComplete({
      scenarioId: id,
      evidence: typeof result.evidence === "string" && result.evidence.trim()
        ? result.evidence.trim()
        : ctx.evidence,
      runAt: ctx.runAt,
      operator: ctx.operator,
      label: loaded.mod.label || REQUIRED_SCENARIO_LABELS[id]
    });
  } catch (err) {
    const payload = {
      ok: false,
      mode: "record",
      scenarioId: id,
      error: `failed to write manifest: ${err?.message || String(err)}`,
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    return 1;
  }

  const after = readManifestSnapshot();
  const payload = {
    ok: true,
    mode: "record",
    scenarioId: id,
    evidence: ctx.evidence,
    run_at: ctx.runAt,
    operator: ctx.operator,
    manifest_mutated: before !== after,
    manifest_path: MANIFEST_REL
  };
  emit(payload, { json: args.json, ok: true });
  return 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  if (!args.scenario || !String(args.scenario).trim()) {
    const payload = {
      ok: false,
      error: "missing --scenario <id>",
      usage: usage()
    };
    emit(payload, { json: args.json, ok: false });
    process.exit(1);
  }

  const id = String(args.scenario).trim();
  if (!isKnownScenarioId(id)) {
    const payload = {
      ok: false,
      scenarioId: id,
      error: `unknown scenario id: ${id}`,
      known_ids: REQUIRED_SCENARIO_IDS,
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    process.exit(1);
  }

  const mode = String(args.mode || "dry-run").trim().toLowerCase();
  if (mode !== "dry-run" && mode !== "record") {
    const payload = {
      ok: false,
      scenarioId: id,
      error: `unknown mode: ${args.mode} (expected dry-run|record)`,
      manifest_mutated: false
    };
    emit(payload, { json: args.json, ok: false });
    process.exit(1);
  }

  args.scenario = id;
  args.mode = mode;
  const code = mode === "record" ? await runRecord(args) : await runDryRun(args);
  process.exit(code);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  });
}

export {
  parseArgs,
  loadScenario,
  runDryRun,
  runRecord,
  REQUIRED_SCENARIO_IDS,
  MANIFEST_REL
};
