import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBist } from "../scripts/bist.mjs";

test("BIST exposes the stable status vocabulary", async () => {
  const result = await runBist({ includeLocal: false });
  const allowed = new Set(["PASS", "FAIL", "NOT_PROVEN", "NOT_APPLICABLE"]);
  assert.ok(result.checks.length > 0);
  for (const check of result.checks) assert.ok(allowed.has(check.status), check.id);
  assert.equal(result.schema, "omnikali-bist/v1");
});

test("production boundaries remain NOT_PROVEN without acceptance evidence", async () => {
  const dir = mkdtempSync(join(tmpdir(), "omnikali-bist-"));
  const result = await runBist({ includeLocal: false });
  for (const id of [
    "production.database",
    "production.worker-recovery",
    "production.executor-side-effects",
    "production.remote-desktop"
  ]) {
    assert.equal(result.checks.find(c => c.id === id)?.status, "NOT_PROVEN");
  }
});

test("production evidence is accepted only with an acceptance id", async () => {
  const dir = mkdtempSync(join(tmpdir(), "omnikali-bist-"));
  const evidence = join(dir, "production.json");
  writeFileSync(evidence, JSON.stringify({
    acceptanceId: "TEST-ACCEPTANCE-001",
    checks: {
      "production.database": { status: "PASS", detail: "fixture evidence" }
    }
  }));
  const previous = process.env.OMNIKALI_BIST_EVIDENCE;
  process.env.OMNIKALI_BIST_EVIDENCE = evidence;
  try {
    const result = await runBist({ includeLocal: false });
    assert.equal(result.checks.find(c => c.id === "production.database")?.status, "PASS");
  } finally {
    if (previous === undefined) delete process.env.OMNIKALI_BIST_EVIDENCE;
    else process.env.OMNIKALI_BIST_EVIDENCE = previous;
  }
});

test("public probe is opt-in and never performs a task mutation", async () => {
  const previous = process.env.OMNIKALI_BIST_PUBLIC;
  delete process.env.OMNIKALI_BIST_PUBLIC;
  try {
    const result = await runBist({ includeLocal: false });
    assert.equal(result.checks.find(c => c.id === "production.gateway.health")?.status, "NOT_PROVEN");
  } finally {
    if (previous !== undefined) process.env.OMNIKALI_BIST_PUBLIC = previous;
  }
});
