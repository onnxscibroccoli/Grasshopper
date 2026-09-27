#!/usr/bin/env node
/**
 * Fail-closed live readiness/acceptance evidence harness.
 *
 * Checks dated evidence artifacts for the eight required live scenarios.
 * This does NOT itself run against production unless an evidence file records
 * a dated authorized run. Missing or undated evidence => OPEN.
 * Exit 1 while any scenario is OPEN.
 *
 * Never treat a COMPLETE static agentic-deploy-readiness report as live
 * acceptance. Scenario runners against Helix land in later PRs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_REL = "reference/production/live-acceptance/manifest.json";
const DOCS_REL = "docs/LIVE_ACCEPTANCE.md";

export const REQUIRED_SCENARIOS = [
  {
    id: "normal_exec",
    label: "Normal authenticated task execution through gateway to worker/Kali"
  },
  {
    id: "worker_termination",
    label: "Worker termination preserves durable task state for reclaim"
  },
  {
    id: "stale_lease_reclaim",
    label: "Expired lease returns task to PENDING and allows reclaim"
  },
  {
    id: "replacement_completion",
    label: "Owner-fenced replacement completion after reclaim"
  },
  {
    id: "duplicate_fencing",
    label: "Duplicate/stale owner identity is fenced from completing"
  },
  {
    id: "gateway_restart",
    label: "Gateway restart preserves accepted work and resumes safely"
  },
  {
    id: "db_failure",
    label: "Database failure/outage surfaces safely without false COMPLETE"
  },
  {
    id: "network_interrupt",
    label: "Network interrupt between gateway/worker/DB does not corrupt task state"
  }
];

const ISO_DATE_RE =
  /\b(20\d{2}-\d{2}-\d{2})(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/;

function readText(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

function readJson(rel) {
  const text = readText(rel);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hasDatedEvidence(scenario) {
  if (!scenario || typeof scenario !== "object") return false;
  const evidence = typeof scenario.evidence === "string" ? scenario.evidence.trim() : "";
  if (!evidence || /^no dated live run yet$/i.test(evidence)) return false;
  if (scenario.run_at && ISO_DATE_RE.test(String(scenario.run_at))) return true;
  if (ISO_DATE_RE.test(evidence)) return true;
  return false;
}

function assessScenario(def, manifestEntry) {
  const base = {
    id: def.id,
    kind: "scenario",
    label: def.label,
    critical: true
  };

  if (!manifestEntry || typeof manifestEntry !== "object") {
    return {
      ...base,
      status: "OPEN",
      evidence: `missing scenario entry in ${MANIFEST_REL}`
    };
  }

  const statusRaw = String(manifestEntry.status || "").toUpperCase();
  const evidence =
    typeof manifestEntry.evidence === "string" && manifestEntry.evidence.trim()
      ? manifestEntry.evidence.trim()
      : "empty evidence";

  if (statusRaw === "COMPLETE") {
    if (!hasDatedEvidence(manifestEntry)) {
      return {
        ...base,
        status: "OPEN",
        evidence: `COMPLETE claimed without dated evidence (need run_at ISO date or dated evidence string); recorded="${evidence}"`
      };
    }
    return {
      ...base,
      status: "COMPLETE",
      evidence,
      run_at: manifestEntry.run_at ?? null,
      operator: manifestEntry.operator ?? null
    };
  }

  return {
    ...base,
    status: "OPEN",
    evidence,
    run_at: manifestEntry.run_at ?? null,
    operator: manifestEntry.operator ?? null
  };
}

export function buildReport() {
  const manifest = readJson(MANIFEST_REL);
  const docsPresent = fs.existsSync(path.join(ROOT, DOCS_REL));

  const scenarios = REQUIRED_SCENARIOS.map((def) => {
    if (!manifest) {
      return {
        id: def.id,
        kind: "scenario",
        label: def.label,
        critical: true,
        status: "OPEN",
        evidence: `missing or unreadable ${MANIFEST_REL}`
      };
    }
    return assessScenario(def, manifest.scenarios?.[def.id]);
  });

  const open = scenarios.filter((s) => s.status === "OPEN");
  const complete = scenarios.filter((s) => s.status === "COMPLETE");
  const ready = open.length === 0;

  return {
    schema_version: 1,
    name: "live-acceptance",
    generated_at: new Date().toISOString(),
    ready,
    exit_policy: "fail-closed: exit 1 while any required scenario is OPEN",
    notes: [
      "Evidence harness only. This script checks dated artifacts under reference/production/live-acceptance/; it does not itself run against production unless an evidence file records a dated authorized run.",
      "Do not claim production deploy success from static agentic-deploy-readiness alone.",
      "Record COMPLETE only with non-secret, dated operator/automation evidence for that scenario.",
      "Scenario runners against Helix are out of scope for this harness scaffold.",
      docsPresent
        ? `docs present: ${DOCS_REL}`
        : `docs missing: ${DOCS_REL} (OPEN evidence still evaluated from manifest when present)`
    ],
    topology: "authenticated client -> Helix gateway -> PostgreSQL -> worker -> Kali",
    manifest_path: MANIFEST_REL,
    manifest_schema_version: manifest?.schema_version ?? null,
    scenarios,
    summary: {
      scenarios_complete: complete.map((s) => s.id),
      scenarios_open: open.map((s) => s.id),
      critical_open: open.filter((s) => s.critical).map((s) => s.id),
      required_count: REQUIRED_SCENARIOS.length,
      complete_count: complete.length,
      open_count: open.length
    }
  };
}

function formatText(report) {
  const lines = [];
  lines.push("Live acceptance evidence harness (fail-closed)");
  lines.push(`ready=${report.ready}`);
  lines.push("");
  lines.push("Scenarios:");
  for (const s of report.scenarios) {
    const crit = s.critical ? "critical" : "advisory";
    lines.push(`  [${s.status}] ${s.id} (${crit}) — ${s.label}`);
    lines.push(`           ${s.evidence}`);
  }
  lines.push("");
  lines.push(`COMPLETE scenarios: ${report.summary.scenarios_complete.join(", ") || "(none)"}`);
  lines.push(`OPEN scenarios: ${report.summary.scenarios_open.join(", ") || "(none)"}`);
  lines.push(`Critical OPEN blockers: ${report.summary.critical_open.join(", ") || "(none)"}`);
  lines.push("");
  for (const note of report.notes) lines.push(`note: ${note}`);
  return lines.join("\n");
}

function main() {
  const report = buildReport();
  const text = formatText(report);
  const wantJson = process.argv.includes("--json");
  if (wantJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(text);
    console.log("");
    console.log("--- JSON ---");
    console.log(JSON.stringify(report, null, 2));
  }
  const anyOpen = report.scenarios.some((s) => s.status === "OPEN");
  process.exit(anyOpen ? 1 : 0);
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main();
}
