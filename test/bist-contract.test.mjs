import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BIST_SCHEMA,
  BIST_STATUSES,
  PRODUCTION_CHECK_IDS,
  PUBLIC_HEALTH_URL,
  parseBistArgs,
  runBist
} from "../scripts/bist.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function checkMap(result) {
  return Object.fromEntries(result.checks.map((check) => [check.id, check]));
}

test("BIST schema enumerates PASS FAIL NOT_PROVEN NOT_APPLICABLE", async () => {
  const result = await runBist({
    cwd: ROOT,
    skipLocalCommands: true,
    allowDirty: true,
    publicProbe: false
  });
  assert.equal(result.schema, BIST_SCHEMA);
  assert.deepEqual(BIST_STATUSES, ["PASS", "FAIL", "NOT_PROVEN", "NOT_APPLICABLE"]);
  assert.equal(typeof result.summary.not_applicable, "number");
  for (const check of result.checks) {
    assert.ok(BIST_STATUSES.includes(check.status), `${check.id} has illegal status ${check.status}`);
  }
  assert.equal(result.checks.find((check) => check.id === "production.k8s-public-ingress").status, "NOT_APPLICABLE");
});

test("production keys stay NOT_PROVEN without a live public probe", async () => {
  const result = await runBist({
    cwd: ROOT,
    skipLocalCommands: true,
    allowDirty: true,
    publicProbe: false,
    evidence: null
  });
  const byId = checkMap(result);
  for (const id of PRODUCTION_CHECK_IDS) {
    assert.equal(byId[id].status, "NOT_PROVEN", id);
  }
});

test("historical acceptance evidence does not promote production checks to PASS", async () => {
  const result = await runBist({
    cwd: ROOT,
    skipLocalCommands: true,
    allowDirty: true,
    publicProbe: false,
    evidence: { acceptanceId: "396780ea-9405-4978-a1bb-2b61c210f8dd" }
  });
  const byId = checkMap(result);
  for (const id of PRODUCTION_CHECK_IDS) {
    assert.equal(byId[id].status, "NOT_PROVEN", id);
    assert.match(byId[id].detail, /396780ea-9405-4978-a1bb-2b61c210f8dd/);
  }
});

test("opt-in public GET /health can PASS production.gateway only", async () => {
  const result = await runBist({
    cwd: ROOT,
    skipLocalCommands: true,
    allowDirty: true,
    publicProbe: true,
    fetchImpl: async (url, init) => {
      assert.equal(url, PUBLIC_HEALTH_URL);
      assert.equal(init.method, "GET");
      return {
        status: 200,
        text: async () => JSON.stringify({ ok: true, oidcConfigured: true })
      };
    }
  });
  const byId = checkMap(result);
  assert.equal(byId["production.gateway"].status, "PASS");
  assert.equal(byId["production.database"].status, "NOT_PROVEN");
  assert.equal(byId["production.remote-desktop"].status, "NOT_PROVEN");
});

test("opt-in public GET /health FAILs on a non-ok body", async () => {
  const result = await runBist({
    cwd: ROOT,
    skipLocalCommands: true,
    allowDirty: true,
    publicProbe: true,
    fetchImpl: async () => ({
      status: 404,
      text: async () => "not found"
    })
  });
  assert.equal(checkMap(result)["production.gateway"].status, "FAIL");
  assert.equal(result.overall, "FAIL");
});

test("BIST source never POSTs /api/v1/tasks", () => {
  const source = fs.readFileSync(path.join(ROOT, "scripts/bist.mjs"), "utf8");
  assert.doesNotMatch(source, /POST\s+\/api\/v1\/tasks/i);
  assert.doesNotMatch(source, /method\s*:\s*["']POST["']/);
});

test("CLI flags map to the contract options", () => {
  const parsed = parseBistArgs(["--skip-local", "--allow-dirty", "--public", "--out", "bist-report.json"], {});
  assert.equal(parsed.skipLocalCommands, true);
  assert.equal(parsed.allowDirty, true);
  assert.equal(parsed.publicProbe, true);
  assert.equal(parsed.outPath, "bist-report.json");
});
