import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSnapshot } from "../scripts/verify-doc-freshness.mjs";

const failedRunNow = Date.parse("2026-10-04T17:26:38Z");

test("snapshot freshness fails closed when the README date is older than 72h", () => {
  const stale = evaluateSnapshot({
    readme: "**Documentation snapshot:** 2026-10-01 00:30 UTC",
    now: failedRunNow,
    maxAgeHours: 72,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.reason, "docs.readme.snapshot_stale");
  assert.ok(stale.ageHours > 89);
  assert.ok(stale.ageHours < 90);
});

test("snapshot freshness accepts the 2026-10-04 documentation snapshot", () => {
  const fresh = evaluateSnapshot({
    readme: "**Documentation snapshot:** 2026-10-04 17:26 UTC",
    now: failedRunNow,
    maxAgeHours: 72,
  });
  assert.equal(fresh.ok, true);
  assert.equal(fresh.reason, "docs.readme.snapshot_fresh");
  assert.ok(fresh.ageHours < 24);
});

test("snapshot freshness rejects a missing marker and a non-positive window", () => {
  assert.equal(evaluateSnapshot({ readme: "no date", now: failedRunNow, maxAgeHours: 72 }).reason, "docs.readme.snapshot_missing");
  assert.equal(evaluateSnapshot({ readme: "Documentation snapshot: 2026-10-04", now: failedRunNow, maxAgeHours: 0 }).code, 2);
});
