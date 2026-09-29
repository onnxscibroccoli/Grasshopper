#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BIST_SCHEMA = "omnikali-bist/v1";
export const BIST_STATUSES = Object.freeze(["PASS", "FAIL", "NOT_PROVEN", "NOT_APPLICABLE"]);
export const PUBLIC_HEALTH_URL = "https://d22bad48irrbqe.cloudfront.net/health";
export const PRODUCTION_CHECK_IDS = Object.freeze([
  "production.gateway",
  "production.database",
  "production.worker-recovery",
  "production.executor-side-effects",
  "production.remote-desktop"
]);

const REQUIRED_SOURCE_PATHS = [
  "IMPLEMENTATION_SEED.md",
  "BASE_SYSTEM_PROTECTION.md",
  "docs/PRODUCTION_LIVE_EVIDENCE.md",
  "docs/ARCHITECTURE_VERIFICATION_2026-09-29.md",
  "scripts/verify-agentic-reproducibility.sh",
  "scripts/verify-live-acceptance.mjs"
];

export function parseBistArgs(argv = process.argv.slice(2), env = process.env) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--") && !arg.includes("=")));
  const getValue = (name) => {
    const prefixed = argv.find((arg) => arg.startsWith(`${name}=`));
    if (prefixed) {
      return prefixed.slice(name.length + 1);
    }
    const index = argv.indexOf(name);
    if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      return argv[index + 1];
    }
    return null;
  };
  return {
    skipLocalCommands: flags.has("--skip-local") || env.OMNIKALI_BIST_SKIP_LOCAL === "1",
    allowDirty: flags.has("--allow-dirty") || env.OMNIKALI_BIST_ALLOW_DIRTY === "1",
    publicProbe: flags.has("--public") || env.OMNIKALI_BIST_PUBLIC === "1",
    outPath: getValue("--out")
  };
}

function add(checks, id, status, detail) {
  if (!BIST_STATUSES.includes(status)) {
    throw new Error(`invalid BIST status ${status} for ${id}`);
  }
  checks.push({ id, status, detail });
}

function readAcceptanceEvidence(cwd) {
  const path = resolve(cwd, "reference/production/bist-acceptance.json");
  if (!existsSync(path)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (!parsed || typeof parsed.acceptanceId !== "string" || parsed.acceptanceId.trim() === "") {
      return { invalid: true, path };
    }
    return { acceptanceId: parsed.acceptanceId.trim(), path };
  } catch (error) {
    return { invalid: true, path, error: error.message };
  }
}

function assertGetOnlyProbe(source) {
  if (/method\s*:\s*["']POST["']/.test(source)) {
    throw new Error("BIST runner must not issue POST requests");
  }
}

export async function probePublicHealth({ fetchImpl, url = PUBLIC_HEALTH_URL }) {
  const response = await fetchImpl(url, {
    method: "GET",
    redirect: "manual",
    headers: { accept: "application/json" }
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const okShape = Boolean(body && body.ok === true);
  if (response.status === 200 && okShape) {
    return {
      status: "PASS",
      detail: `GET ${url} returned ok=true`
    };
  }
  return {
    status: "FAIL",
    detail: `GET ${url} did not return {ok:true} (HTTP ${response.status})`
  };
}

export async function runBist(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const checks = [];
  const sourceText = readFileSync(new URL(import.meta.url), "utf8");
  assertGetOnlyProbe(sourceText);

  const major = Number(process.versions.node.split(".")[0]);
  add(checks, "runtime.node", major >= 20 ? "PASS" : "FAIL", `Node.js ${process.version}`);

  for (const relative of REQUIRED_SOURCE_PATHS) {
    const present = existsSync(resolve(cwd, relative));
    add(
      checks,
      `source.${relative}`,
      present ? "PASS" : "FAIL",
      present ? "required artifact present" : "required artifact missing"
    );
  }

  if (options.allowDirty) {
    add(checks, "source.clean", "NOT_APPLICABLE", "dirty working tree allowed by BIST contract flags");
  } else {
    try {
      const status = execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" }).trim();
      add(
        checks,
        "source.clean",
        status === "" ? "PASS" : "FAIL",
        status === "" ? "working tree clean" : "working tree contains uncommitted changes"
      );
    } catch (error) {
      add(checks, "source.git", "FAIL", error.message);
    }
  }

  if (options.skipLocalCommands) {
    add(checks, "local.unit-tests", "NOT_APPLICABLE", "skipped to avoid recursive test execution");
    add(checks, "local.verify-reference", "NOT_APPLICABLE", "skipped to avoid recursive verification");
  } else {
    for (const [id, command, args] of [
      ["local.unit-tests", "npm", ["test"]],
      ["local.verify-reference", "npm", ["run", "verify:reference"]]
    ]) {
      try {
        execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        add(checks, id, "PASS", "command completed successfully");
      } catch (error) {
        const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
        add(checks, id, "FAIL", output.slice(0, 500) || "command failed");
      }
    }
  }

  const evidence = options.evidence === undefined ? readAcceptanceEvidence(cwd) : options.evidence;
  const historical = evidence && evidence.acceptanceId
    ? ` historical acceptance ${evidence.acceptanceId} is cited only; not live proof`
    : "";

  if (options.publicProbe) {
    try {
      const probe = await probePublicHealth({
        fetchImpl: options.fetchImpl ?? globalThis.fetch,
        url: options.publicHealthUrl ?? PUBLIC_HEALTH_URL
      });
      add(checks, "production.gateway", probe.status, probe.detail);
    } catch (error) {
      add(checks, "production.gateway", "FAIL", `public GET /health failed: ${error.message}`);
    }
  } else {
    add(
      checks,
      "production.gateway",
      "NOT_PROVEN",
      `public GET /health disabled; set OMNIKALI_BIST_PUBLIC=1 or --public.${historical}`
    );
  }

  add(checks, "production.database", "NOT_PROVEN", `requires authorized live verification; BIST does not open a database session.${historical}`);
  add(checks, "production.worker-recovery", "NOT_PROVEN", `requires authorized failure-injection acceptance.${historical}`);
  add(checks, "production.executor-side-effects", "NOT_PROVEN", `requires command-type-specific executor acceptance.${historical}`);
  add(checks, "production.remote-desktop", "NOT_PROVEN", `requires authenticated browser-to-intended-guest acceptance.${historical}`);
  add(checks, "production.k8s-public-ingress", "NOT_APPLICABLE", "Kubernetes is not the current public origin");

  const failures = checks.filter((check) => check.status === "FAIL");
  return {
    schema: BIST_SCHEMA,
    timestamp: new Date().toISOString(),
    publicHealthUrl: PUBLIC_HEALTH_URL,
    checks,
    summary: {
      pass: checks.filter((check) => check.status === "PASS").length,
      fail: failures.length,
      not_proven: checks.filter((check) => check.status === "NOT_PROVEN").length,
      not_applicable: checks.filter((check) => check.status === "NOT_APPLICABLE").length
    },
    overall: failures.length ? "FAIL" : "PASS_WITH_NOT_PROVEN"
  };
}

export function formatBist(result) {
  return `${JSON.stringify(result, null, 2)}\n`;
}

const invokedAsCli = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (invokedAsCli) {
  const args = parseBistArgs();
  const result = await runBist(args);
  const text = formatBist(result);
  process.stdout.write(text);
  if (args.outPath) {
    writeFileSync(args.outPath, text);
  }
  process.exitCode = result.summary.fail ? 1 : 0;
}
