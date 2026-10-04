#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function readSnapshotDate(readme) {
  const match = String(readme).match(/(?:Documentation snapshot|Documentation status)[^0-9]*(\d{4}-\d{2}-\d{2})/i);
  return match ? match[1] : null;
}

export function snapshotAgeHours(snapshotDate, now = Date.now()) {
  const parsed = new Date(`${snapshotDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return (now - parsed.getTime()) / 3_600_000;
}

export function evaluateSnapshot({ readme, now = Date.now(), maxAgeHours }) {
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    return { ok: false, code: 2, reason: "invalid_max_age" };
  }
  const snapshotDate = readSnapshotDate(readme);
  if (!snapshotDate) {
    return { ok: false, code: 1, reason: "docs.readme.snapshot_missing" };
  }
  const ageHours = snapshotAgeHours(snapshotDate, now);
  if (ageHours == null || ageHours > maxAgeHours) {
    return { ok: false, code: 1, reason: "docs.readme.snapshot_stale", snapshotDate, ageHours };
  }
  return { ok: true, code: 0, reason: "docs.readme.snapshot_fresh", snapshotDate, ageHours };
}

function main() {
  const maxAgeHours = Number(process.env.DOC_FRESHNESS_MAX_HOURS || "72");
  const readme = fs.readFileSync("README.md", "utf8");
  const result = evaluateSnapshot({ readme, maxAgeHours });

  if (result.reason === "invalid_max_age") {
    console.error("DOC_FRESHNESS_MAX_HOURS must be a positive number");
    process.exit(2);
  }
  if (result.snapshotDate) {
    console.log(`DOC_SNAPSHOT_DATE=${result.snapshotDate}`);
    console.log(`DOC_SNAPSHOT_AGE_HOURS=${result.ageHours.toFixed(1)}`);
    console.log(`DOC_FRESHNESS_MAX_HOURS=${maxAgeHours}`);
  }
  if (!result.ok) {
    console.error(`FAIL ${result.reason}`);
    process.exit(result.code);
  }
  console.log(`PASS ${result.reason}`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) main();
