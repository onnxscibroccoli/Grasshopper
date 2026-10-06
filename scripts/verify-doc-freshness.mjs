#!/usr/bin/env node
import fs from "node:fs";

// Regression note (run 37450102719, job 112224337447, SHA b5dd3a3d):
// FAIL docs.readme.snapshot_stale when README "Documentation snapshot" is older
// than DOC_FRESHNESS_MAX_HOURS (default 72). Observed DOC_SNAPSHOT_DATE=2026-10-01
// at DOC_SNAPSHOT_AGE_HOURS=130.5. Repro: node scripts/verify-doc-freshness.mjs
// must print PASS docs.readme.snapshot_fresh for a snapshot within the window.

const maxAgeHours = Number(process.env.DOC_FRESHNESS_MAX_HOURS || "72");
if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
  console.error("DOC_FRESHNESS_MAX_HOURS must be a positive number");
  process.exit(2);
}

const readme = fs.readFileSync("README.md", "utf8");
const match = readme.match(/(?:Documentation snapshot|Documentation status)[^0-9]*(\d{4}-\d{2}-\d{2})/i);

if (!match) {
  console.error("FAIL docs.readme.snapshot_missing");
  process.exit(1);
}

const snapshotDate = new Date(`${match[1]}T00:00:00Z`);
const ageHours = (Date.now() - snapshotDate.getTime()) / 3_600_000;

console.log(`DOC_SNAPSHOT_DATE=${match[1]}`);
console.log(`DOC_SNAPSHOT_AGE_HOURS=${ageHours.toFixed(1)}`);
console.log(`DOC_FRESHNESS_MAX_HOURS=${maxAgeHours}`);

if (ageHours > maxAgeHours) {
  console.error("FAIL docs.readme.snapshot_stale");
  process.exit(1);
}

console.log("PASS docs.readme.snapshot_fresh");
