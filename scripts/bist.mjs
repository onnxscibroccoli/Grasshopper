#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const checks = [];
const add = (id, status, detail) => checks.push({ id, status, detail });

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
  add(`source.${path}`, existsSync(path) ? "PASS" : "FAIL", existsSync(path) ? "required artifact present" : "required artifact missing");
}

try {
  const status = execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  add("source.clean", status === "" ? "PASS" : "FAIL", status === "" ? "working tree clean" : "working tree contains uncommitted changes");
} catch (error) {
  add("source.git", "FAIL", error.message);
}

for (const [command, args] of [
  ["npm", ["test"]],
  ["npm", ["run", "verify:reference"]]
]) {
  try {
    execFileSync(command, args, { stdio: "ignore" });
    add(`local.${args.join(".")}`, "PASS", "command completed successfully");
  } catch {
    add(`local.${args.join(".")}`, "FAIL", "command failed");
  }
}

add("production.gateway", "NOT_PROVEN", "BIST runner does not silently mutate or authenticate against production");
add("production.database", "NOT_PROVEN", "requires authorized live verification");
add("production.worker-recovery", "NOT_PROVEN", "requires authorized failure-injection acceptance");
add("production.executor-side-effects", "NOT_PROVEN", "requires command-type-specific executor acceptance");
add("production.remote-desktop", "NOT_PROVEN", "requires authenticated browser-to-intended-guest acceptance");

const failures = checks.filter(c => c.status === "FAIL");
const result = {
  schema: "omnikali-bist/v1",
  timestamp: new Date().toISOString(),
  checks,
  summary: {
    pass: checks.filter(c => c.status === "PASS").length,
    fail: failures.length,
    not_proven: checks.filter(c => c.status === "NOT_PROVEN").length
  },
  overall: failures.length ? "FAIL" : "PASS_WITH_NOT_PROVEN"
};

console.log(JSON.stringify(result, null, 2));
process.exitCode = failures.length ? 1 : 0;
