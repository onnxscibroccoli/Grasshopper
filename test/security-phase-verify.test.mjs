#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const verifier = join(root, "scripts", "security-phase-verify.sh");
const fakeBin = mkdtempSync(join(tmpdir(), "grasshopper-security-phase-"));
writeFileSync(join(fakeBin, "ss"), "#!/usr/bin/env bash\nprintf '%s\\n' 'LISTEN 127.0.0.1:18789' 'LISTEN 127.0.0.1:11434'\n");
spawnSync("chmod", ["+x", join(fakeBin, "ss")]);

function run(extra = {}) {
  const result = spawnSync("bash", [verifier], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      GRASSHOPPER_BACKUP_STATUS: "PASS",
      GRASSHOPPER_RESTORE_STATUS: "PASS",
      GRASSHOPPER_SECURITY_PHASE: "",
      GRASSHOPPER_PERMISSIVE: "0",
      GRASSHOPPER_BROAD_OPERATOR_SCOPES: "0",
      GRASSHOPPER_ALLOW_PUBLIC_GATEWAY: "0",
      GRASSHOPPER_SANDBOX_ID: "",
      ...extra,
    },
  });
  return result;
}

// Regression: Reference tests run 36795408721 failed because this file used
// `const fs = await import("node:fs")` inside a non-async test callback.
// Module-scope static import keeps the assertion parseable under node --test.
test("bootstrap declares DEV_SANDBOX", () => {
  const bootstrap = readFileSync(new URL("../scripts/oci-openclaw-bootstrap.sh", import.meta.url), "utf8");
  assert.match(bootstrap, /GRASSHOPPER_SECURITY_PHASE=DEV_SANDBOX/);
});

test("missing phase fails", () => {
  assert.notEqual(run().status, 0);
});

test("unknown phase fails", () => {
  assert.notEqual(run({ GRASSHOPPER_SECURITY_PHASE: "UNKNOWN" }).status, 0);
});

test("DEV_SANDBOX with explicit permissiveness passes", () => {
  assert.equal(run({
    GRASSHOPPER_SECURITY_PHASE: "DEV_SANDBOX",
    GRASSHOPPER_PERMISSIVE: "1",
    GRASSHOPPER_BROAD_OPERATOR_SCOPES: "1",
    GRASSHOPPER_SANDBOX_ID: "test-sandbox",
  }).status, 0);
});

test("STAGING rejects permissive mode", () => {
  assert.notEqual(run({
    GRASSHOPPER_SECURITY_PHASE: "STAGING",
    GRASSHOPPER_PERMISSIVE: "1",
  }).status, 0);
});

test("STAGING rejects broad operator scopes", () => {
  assert.notEqual(run({
    GRASSHOPPER_SECURITY_PHASE: "STAGING",
    GRASSHOPPER_BROAD_OPERATOR_SCOPES: "1",
  }).status, 0);
});

test("public Gateway override fails in every phase", () => {
  assert.notEqual(run({
    GRASSHOPPER_SECURITY_PHASE: "DEV_SANDBOX",
    GRASSHOPPER_ALLOW_PUBLIC_GATEWAY: "1",
  }).status, 0);
});

// Regression: Reference tests run 36794791818 failed because the verifier
// accepted DEV_SANDBOX when RESTORE_STATUS=NOT_PROVEN (exit 0).
// Keep this assertion coupled to FAIL restore.status output.
test("backup or restore evidence missing fails", () => {
  const result = run({
    GRASSHOPPER_SECURITY_PHASE: "DEV_SANDBOX",
    GRASSHOPPER_BACKUP_STATUS: "PASS",
    GRASSHOPPER_RESTORE_STATUS: "NOT_PROVEN",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /FAIL restore\.status/);
});

test("self-test proves missing-input failure and fixture pass", () => {
  const result = spawnSync("bash", [verifier, "--self-test"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      GRASSHOPPER_SECURITY_PHASE: "PROD",
      GRASSHOPPER_BACKUP_STATUS: "PASS",
      GRASSHOPPER_RESTORE_STATUS: "PASS",
    },
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /SELF_TEST missing=FAIL/);
  assert.match(result.stdout, /SELF_TEST fixture=PASS/);
  assert.match(result.stdout, /SECURITY_PHASE_SELF_TEST=PASS/);
});
