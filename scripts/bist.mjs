#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const VALID = new Set(["PASS", "FAIL", "NOT_PROVEN", "NOT_APPLICABLE"]);
const checks = [];

function add(id, status, detail, { blocking = true } = {}) {
  if (!VALID.has(status)) throw new Error(`invalid BIST status: ${status}`);
  checks.push({ id, status, detail, blocking });
}

function run(command, args) {
  try {
    const stdout = execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? ""),
      stderr: String(error.stderr ?? error.message ?? "")
    };
  }
}

function tail(text, limit = 1200) {
  const value = String(text ?? "").trim();
  return value.length > limit ? value.slice(-limit) : value;
}

function loadEvidence(path) {
  if (!existsSync(path)) return null;
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (!value.acceptanceId || typeof value.acceptanceId !== "string") return null;
    return value;
  } catch {
    return null;
  }
}

async function publicHealthProbe() {
  const url = process.env.OMNIKALI_BIST_PUBLIC_URL ??
    "https://d22bad48irrbqe.cloudfront.net/health";
  try {
    const response = await fetch(url, { method: "GET", redirect: "error" });
    const body = await response.json();
    if (response.status !== 200 || body?.ok !== true) {
      return { status: "FAIL", detail: `HTTP ${response.status}; expected JSON ok=true` };
    }
    return { status: "PASS", detail: `HTTP 200; ok=true; ${url}` };
  } catch (error) {
    return { status: "FAIL", detail: error instanceof Error ? error.message : String(error) };
  }
}

export async function runBist() {
  const major = Number(process.versions.node.split(".")[0]);
  add("runtime.node", major >= 20 ? "PASS" : "FAIL", `Node.js ${process.version}`);

  for (const path of [
    "IMPLEMENTATION_SEED.md",
    "BASE_SYSTEM_PROTECTION.md",
    "docs/PRODUCTION_LIVE_EVIDENCE.md",
    "docs/ARCHITECTURE_VERIFICATION_2026-09-29.md",
    "scripts/verify-agentic-reproducibility.sh",
    "scripts/verify-live-acceptance.mjs"
  ]) {
    add(`source.required.${path}`, existsSync(path) ? "PASS" : "FAIL",
      existsSync(path) ? "required artifact present" : "required artifact missing");
  }

  if (process.env.OMNIKALI_BIST_REQUIRE_CLEAN === "1") {
    const git = run("git", ["status", "--porcelain"]);
    add("source.clean", git.ok && git.stdout.trim() === "" ? "PASS" : "FAIL",
      git.ok && git.stdout.trim() === "" ? "working tree clean" : "working tree is dirty",
      { blocking: true });
  } else {
    add("source.clean", "NOT_APPLICABLE",
      "clean-checkout enforcement is separate; set OMNIKALI_BIST_REQUIRE_CLEAN=1 to require it",
      { blocking: false });
  }

  for (const [id, command, args] of [
    ["local.unit-tests", "npm", ["test"]],
    ["local.reference-verification", "npm", ["run", "verify:reference"]]
  ]) {
    const result = run(command, args);
    add(id, result.ok ? "PASS" : "FAIL",
      result.ok ? "command completed successfully" : `command failed\n${tail(result.stderr || result.stdout)}`);
  }

  if (process.env.OMNIKALI_BIST_PUBLIC === "1") {
    const probe = await publicHealthProbe();
    add("production.gateway.health", probe.status, probe.detail);
  } else {
    add("production.gateway.health", "NOT_PROVEN",
      "public probe disabled; BIST never authenticates or mutates production");
  }

  const evidencePath = process.env.OMNIKALI_BIST_EVIDENCE ?? "evidence/bist-production.json";
  const evidence = loadEvidence(evidencePath);
  const productionIds = [
    ["production.database", "authorized database acceptance evidence"],
    ["production.worker-recovery", "authorized failure-injection acceptance evidence"],
    ["production.executor-side-effects", "command-type-specific executor acceptance evidence"],
    ["production.remote-desktop", "authenticated browser-to-intended-guest acceptance evidence"]
  ];

  for (const [id, fallback] of productionIds) {
    const entry = evidence?.checks?.[id];
    if (entry && VALID.has(entry.status) && evidence.acceptanceId) {
      add(id, entry.status, `acceptance ${evidence.acceptanceId}: ${entry.detail ?? "evidence supplied"}`);
    } else {
      add(id, "NOT_PROVEN", `${fallback}; no valid acceptance evidence supplied`);
    }
  }

  add("production.kubernetes", "NOT_APPLICABLE",
    "Kubernetes is an isolated prototype, not the current public production path",
    { blocking: false });

  const failures = checks.filter(c => c.status === "FAIL" && c.blocking);
  const result = {
    schema: "omnikali-bist/v1",
    timestamp: new Date().toISOString(),
    checks,
    summary: {
      pass: checks.filter(c => c.status === "PASS").length,
      fail: checks.filter(c => c.status === "FAIL").length,
      not_proven: checks.filter(c => c.status === "NOT_PROVEN").length,
      not_applicable: checks.filter(c => c.status === "NOT_APPLICABLE").length
    },
    overall: failures.length ? "FAIL" : "PASS_WITH_NOT_PROVEN"
  };

  if (process.env.OMNIKALI_BIST_OUTPUT) {
    writeFileSync(process.env.OMNIKALI_BIST_OUTPUT, JSON.stringify(result, null, 2) + "\n");
  }
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runBist();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.overall === "FAIL" ? 1 : 0;
}
