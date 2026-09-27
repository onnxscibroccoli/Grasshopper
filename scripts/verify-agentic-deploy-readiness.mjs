#!/usr/bin/env node
/**
 * Static, fail-closed agentic deploy-readiness gate.
 *
 * This checks repository evidence only. Passing does not mean a live Helix
 * host was reconstructed or that production deploy succeeded. A COMPLETE
 * artifact scan is necessary but not sufficient for live reproduction.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REQUIRED_RECOVERY_POINTS = 14;

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readText(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

function readJson(rel) {
  const text = readText(rel);
  if (text === null) return null;
  return JSON.parse(text);
}

function artifact(id, label, paths, { optional = false } = {}) {
  const missing = paths.filter((p) => !exists(p));
  const present = paths.filter((p) => exists(p));
  let status;
  if (missing.length === 0) status = "COMPLETE";
  else if (optional || present.length === 0) status = "OPEN";
  else status = "OPEN";
  return {
    id,
    kind: "artifact",
    label,
    status,
    critical: false,
    optional: Boolean(optional),
    present,
    missing,
    evidence: missing.length === 0
      ? `present: ${present.join(", ")}`
      : `missing: ${missing.join(", ")}`
  };
}

function gate(id, label, status, evidence, { critical = true } = {}) {
  return {
    id,
    kind: "gate",
    label,
    status,
    critical,
    evidence
  };
}

function countVerifiedRestorePoints(docBundle) {
  // Fail closed: only count explicit verified restore-point language.
  // Never invent or round up from aspirational "fourteen" targets.
  const claims = [];
  const onePointPatterns = [
    /database-level restore evidence for one recovery point/i,
    /one database-level restore/i,
    /one backup decrypted and restored/i,
    /isolated restore evidence for the first point/i,
    /\bone verified\b.{0,40}\brecovery point/i,
    /\bone recovery point\b/i
  ];
  let verified = 0;
  for (const [name, text] of Object.entries(docBundle)) {
    if (!text) continue;
    for (const pattern of onePointPatterns) {
      if (pattern.test(text)) {
        verified = Math.max(verified, 1);
        claims.push(`${name}: matched ${pattern}`);
      }
    }
    // Explicit numeric claim: "N verified ... recovery point(s)"
    const numeric = [...text.matchAll(/\b(\d+)\s+verified\b[^.!\n]{0,80}\brecovery points?\b/gi)];
    for (const match of numeric) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > verified) {
        verified = n;
        claims.push(`${name}: numeric verified claim ${n}`);
      }
    }
  }
  // Reject aspirational fourteen-day language as evidence of fourteen points.
  const aspirational = /fourteen-day independent coverage remain unproven|retention target remain open|not a fourteen-day recovery claim|at least 14 retained recovery points \(target/i;
  for (const [name, text] of Object.entries(docBundle)) {
    if (text && aspirational.test(text)) {
      claims.push(`${name}: aspirational/open fourteen-day language present`);
    }
  }
  return { verified, claims };
}

function assessLineage(manifest, reconstructionStatus) {
  const manifestGate = manifest?.gates?.clean_release_lineage;
  const dirty = manifest?.source_of_truth?.deployed_checkout_clean === false;
  const statusText = reconstructionStatus || "";
  const lineageOpen =
    manifestGate === "blocked" ||
    dirty ||
    /clean source\/release lineage/i.test(statusText) ||
    /dirty/i.test(statusText);
  if (lineageOpen) {
    return gate(
      "lineage",
      "Clean source/release lineage",
      "OPEN",
      `manifest.clean_release_lineage=${manifestGate ?? "missing"}; deployed_checkout_clean=${manifest?.source_of_truth?.deployed_checkout_clean ?? "missing"}`
    );
  }
  return gate(
    "lineage",
    "Clean source/release lineage",
    "COMPLETE",
    "manifest reports clean release lineage"
  );
}

function assessSecretsInjection(reconstructionStatus, secretDoc) {
  const text = `${reconstructionStatus || ""}\n${secretDoc || ""}`;
  const stillHostEnv = /still uses the existing protected host environment/i.test(text);
  const migrationOpen = /Migration to secret-manager-backed injection remains/i.test(text);
  const remaining = /secret-manager-backed agent credential injection/i.test(text);
  if (stillHostEnv || migrationOpen || remaining) {
    return gate(
      "secrets_injection",
      "Secret-manager-backed agent credential injection",
      "OPEN",
      "docs still require controlled secret-manager migration and full acceptance; host env injection remains current"
    );
  }
  // Fail closed if we cannot positively prove completion.
  return gate(
    "secrets_injection",
    "Secret-manager-backed agent credential injection",
    "OPEN",
    "no positive completion evidence for secret-manager injection"
  );
}

function assessLiveAcceptance(manifest, reconstructionStatus) {
  const acceptance = manifest?.gates?.acceptance_automation;
  const text = reconstructionStatus || "";
  const open =
    acceptance === "incomplete" ||
    acceptance === "blocked" ||
    /readiness and acceptance automation/i.test(text) ||
    /authenticated Helix gateway\/worker task against the restored database/i.test(text);
  if (open) {
    return gate(
      "live_acceptance_automation",
      "Live readiness and acceptance automation",
      "OPEN",
      `manifest.acceptance_automation=${acceptance ?? "missing"}; live acceptance remains deployment-time/open`
    );
  }
  return gate(
    "live_acceptance_automation",
    "Live readiness and acceptance automation",
    "OPEN",
    "no positive completion evidence for live acceptance automation"
  );
}

function assessBackupRetention(docBundle) {
  const { verified, claims } = countVerifiedRestorePoints(docBundle);
  const rdsOneDay = Object.values(docBundle).some(
    (t) => t && (/remains 1 day/i.test(t) || /currently 1 day/i.test(t) || /PITR window[\s\S]{0,40}=\s*1 day/i.test(t))
  );
  if (verified < REQUIRED_RECOVERY_POINTS) {
    return gate(
      "backup_retention",
      `Independent backup retention (>=${REQUIRED_RECOVERY_POINTS} distinct restorable points)`,
      "OPEN",
      `verified_restore_points=${verified} (required=${REQUIRED_RECOVERY_POINTS}); rds_pitr_still_1_day=${rdsOneDay}; claims=${claims.join(" | ") || "none"}`
    );
  }
  return gate(
    "backup_retention",
    `Independent backup retention (>=${REQUIRED_RECOVERY_POINTS} distinct restorable points)`,
    "COMPLETE",
    `verified_restore_points=${verified}; claims=${claims.join(" | ")}`
  );
}

function assessCleanHost(manifest, reconstructionStatus) {
  const hostGate = manifest?.gates?.clean_host_reconstruction;
  const text = reconstructionStatus || "";
  const open =
    hostGate === "blocked" ||
    /deterministic clean-host reconstruction/i.test(text) ||
    /not proof that the whole host can be reconstructed from a clean Git checkout/i.test(text);
  if (open) {
    return gate(
      "clean_host_reconstruction",
      "Deterministic clean-host reconstruction",
      "OPEN",
      `manifest.clean_host_reconstruction=${hostGate ?? "missing"}`
    );
  }
  return gate(
    "clean_host_reconstruction",
    "Deterministic clean-host reconstruction",
    "OPEN",
    "no positive completion evidence for clean-host reconstruction"
  );
}

function assessNoNeonProduction() {
  const packageJson = readText("package.json") || "";
  const repro = readText("docs/PRODUCTION_REPRODUCIBILITY.md") || "";
  const arch = readText("docs/ARCHITECTURE.md") || "";
  const introducesNeonDep = /"@neondatabase\/|"neon"|"neondb"/i.test(packageJson);
  const claimsNeonProd = /neon as production|production.*neon|neon.*production database/i.test(
    `${repro}\n${arch}`
  );
  if (introducesNeonDep || claimsNeonProd) {
    return gate(
      "no_neon_production",
      "No Neon as production persistence",
      "OPEN",
      "Neon production dependency or claim detected",
      { critical: true }
    );
  }
  return gate(
    "no_neon_production",
    "No Neon as production persistence",
    "COMPLETE",
    "no Neon production dependency introduced; PostgreSQL remains the documented production path",
    { critical: false }
  );
}

function buildReport() {
  const artifacts = [
    artifact("executor_contract", "Executor contract", ["src/executor-contract.mjs"]),
    artifact("durable_executor", "Durable executor", ["src/production/durable-agent-executor.mjs"]),
    artifact("rds_infra_module", "RDS infrastructure module", [
      "infra/aws/control-plane-db",
      "infra/aws/control-plane-db/main.tf"
    ]),
    artifact("backup_runner_policy", "Independent backup runner and policy", [
      "scripts/independent-postgres-backup.mjs",
      "lib/independent-backup-policy.mjs",
      "docs/INDEPENDENT_POSTGRES_BACKUP.md",
      "docs/INDEPENDENT_POSTGRES_BACKUP_RUNNER.md"
    ]),
    artifact("production_reproducibility_docs", "Production reproducibility docs", [
      "docs/PRODUCTION_REPRODUCIBILITY.md",
      "docs/PRODUCTION_RECONSTRUCTION_STATUS.md",
      "reference/production/reconstruction-manifest.json"
    ]),
    artifact(
      "grok_control_plane_client",
      "Grok control-plane client (absent on main until PR merges)",
      [
        "src/grok-control-plane-client.mjs",
        "src/mcp/grok-control-plane-tools.mjs",
        ".grok/skills/omnikali-control-plane/SKILL.md"
      ],
      { optional: true }
    )
  ];

  const manifest = readJson("reference/production/reconstruction-manifest.json");
  const reconstructionStatus = readText("docs/PRODUCTION_RECONSTRUCTION_STATUS.md");
  const backupDoc = readText("docs/INDEPENDENT_POSTGRES_BACKUP.md");
  const backupRunnerDoc = readText("docs/INDEPENDENT_POSTGRES_BACKUP_RUNNER.md");
  const secretDoc = readText("docs/PRODUCTION_AGENT_SECRET_RECONSTRUCTION.md") ||
    readText("docs/AGENT_SECRET_CONTRACT.md");

  const docBundle = {
    "docs/PRODUCTION_RECONSTRUCTION_STATUS.md": reconstructionStatus,
    "docs/INDEPENDENT_POSTGRES_BACKUP.md": backupDoc,
    "docs/INDEPENDENT_POSTGRES_BACKUP_RUNNER.md": backupRunnerDoc
  };

  const gates = [
    assessLineage(manifest, reconstructionStatus),
    assessSecretsInjection(reconstructionStatus, secretDoc),
    assessLiveAcceptance(manifest, reconstructionStatus),
    assessBackupRetention(docBundle),
    assessCleanHost(manifest, reconstructionStatus),
    assessNoNeonProduction()
  ];

  const criticalOpen = gates.filter((g) => g.critical && g.status === "OPEN");
  const ready = criticalOpen.length === 0;
  const restorePoints = countVerifiedRestorePoints(docBundle);

  return {
    schema_version: 1,
    name: "agentic-deploy-readiness",
    generated_at: new Date().toISOString(),
    ready,
    exit_policy: "fail-closed: exit 1 while any critical gate is OPEN",
    notes: [
      "Static gate only. COMPLETE repository artifacts do not equal live reproduction.",
      "Do not treat this report as evidence of a successful production deploy.",
      `Verified independent DB-level restore points counted from docs: ${restorePoints.verified} (required ${REQUIRED_RECOVERY_POINTS}).`,
      "Grok client is OPEN until its files exist on the branch under check (may remain absent until PR #27 merges)."
    ],
    topology: "Helix gateway -> PostgreSQL -> worker -> Kali",
    adjacent_prs: {
      inventory_draft: 22,
      backup_tls_draft: 23,
      grok_client: 27
    },
    artifacts,
    gates,
    summary: {
      artifacts_complete: artifacts.filter((a) => a.status === "COMPLETE").map((a) => a.id),
      artifacts_open: artifacts.filter((a) => a.status === "OPEN").map((a) => a.id),
      gates_complete: gates.filter((g) => g.status === "COMPLETE").map((g) => g.id),
      gates_open: gates.filter((g) => g.status === "OPEN").map((g) => g.id),
      critical_open: criticalOpen.map((g) => g.id),
      verified_restore_points: restorePoints.verified,
      required_restore_points: REQUIRED_RECOVERY_POINTS
    }
  };
}

function formatText(report) {
  const lines = [];
  lines.push("Agentic deploy readiness (static, fail-closed)");
  lines.push(`ready=${report.ready}`);
  lines.push("");
  lines.push("Artifacts:");
  for (const a of report.artifacts) {
    lines.push(`  [${a.status}] ${a.id} — ${a.label}`);
    lines.push(`           ${a.evidence}`);
  }
  lines.push("");
  lines.push("Gates:");
  for (const g of report.gates) {
    const crit = g.critical ? "critical" : "advisory";
    lines.push(`  [${g.status}] ${g.id} (${crit}) — ${g.label}`);
    lines.push(`           ${g.evidence}`);
  }
  lines.push("");
  lines.push(`COMPLETE artifacts: ${report.summary.artifacts_complete.join(", ") || "(none)"}`);
  lines.push(`OPEN artifacts: ${report.summary.artifacts_open.join(", ") || "(none)"}`);
  lines.push(`COMPLETE gates: ${report.summary.gates_complete.join(", ") || "(none)"}`);
  lines.push(`OPEN gates: ${report.summary.gates_open.join(", ") || "(none)"}`);
  lines.push(`Critical OPEN blockers: ${report.summary.critical_open.join(", ") || "(none)"}`);
  lines.push(
    `Verified restore points: ${report.summary.verified_restore_points}/${report.summary.required_restore_points}`
  );
  lines.push("");
  for (const note of report.notes) lines.push(`note: ${note}`);
  return lines.join("\n");
}

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

const criticalOpen = report.gates.some((g) => g.critical && g.status === "OPEN");
process.exit(criticalOpen ? 1 : 0);
