import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSnapshot } from "../scripts/verify-doc-freshness.mjs";

const now = Date.parse("2026-10-04T09:54:47Z");

test("snapshot freshness fails closed when the README date is older than 72h", () => {
  const stale = evaluateSnapshot({
    readme: "**Documentation snapshot:** 2026-10-01 00:30 UTC",
    now,
    maxAgeHours: 72,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "docs.readme.snapshot_stale");
  assert.ok(stale.ageHours > 72);
  assert.ok(stale.ageHours < 82);
});

test("snapshot freshness accepts a same-day documentation snapshot", () => {
  const fresh = evaluateSnapshot({
    readme: "**Documentation snapshot:** 2026-10-04 11:20 UTC",
    now,
    maxAgeHours: 72,
  });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.reason, "docs.readme.snapshot_fresh");
  assert.ok(fresh.ageHours < 24);
});

test("snapshot freshness rejects a missing marker and a non-positive window", () => {
  assert.equal(evaluateSnapshot({ readme: "no date", now, maxAgeHours: 72 }).reason, "docs.readme.snapshot_missing");
  assert.equal(evaluateSnapshot({ readme: "Documentation snapshot: 2026-10-04", now, maxAgeHours: 0 }).code, 2);
});
