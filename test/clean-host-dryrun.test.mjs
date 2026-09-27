import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = path.join(ROOT, "scripts/verify-clean-host-dryrun.mjs");
const DOC = path.join(ROOT, "docs/CLEAN_HOST_RECONSTRUCTION.md");
const MANIFEST = path.join(ROOT, "reference/production/reconstruction-manifest.json");

test("clean-host reconstruction doc exists and stays fail-closed", () => {
  const text = fs.readFileSync(DOC, "utf8");
  assert.match(text, /OPEN \/ blocked/i);
  assert.match(text, /clean-reconstruction-38903b0/);
  assert.match(text, /46ba4b7/);
  assert.match(text, /Static validator PASS ≠ live clean-host COMPLETE/);
  assert.doesNotMatch(text, /AGENT_TOKEN\s*[:=]\s*['\"]?[A-Za-z0-9_-]{16,}/);
});

test("package.json exposes verify:clean-host-dryrun", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts["verify:clean-host-dryrun"], "node scripts/verify-clean-host-dryrun.mjs");
});

test("manifest clean_host_reconstruction is blocked today", () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  assert.equal(manifest.gates.clean_host_reconstruction, "blocked");
});

test("verify-clean-host-dryrun exits non-zero while gate blocked", () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    timeout: 120000
  });
  assert.equal(result.status, 1, `expected fail-closed exit 1, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  const report = JSON.parse(result.stdout);
  assert.equal(report.clean_host_reconstruction, "blocked");
  assert.equal(report.blocked, true);
  assert.equal(report.status, "FAIL_CLOSED");
});
