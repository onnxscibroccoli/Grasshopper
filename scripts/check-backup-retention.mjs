#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { validateRecoverySet } from "../lib/independent-backup-policy.mjs";

const [manifestFile, nowArg] = process.argv.slice(2);
if (!manifestFile) {
  console.error("usage: check-backup-retention.mjs MANIFESTS.json [NOW]");
  process.exit(2);
}
const manifests = JSON.parse(await readFile(manifestFile, "utf8"));
if (!Array.isArray(manifests)) throw new Error("manifest input must be an array");
const result = validateRecoverySet(manifests, nowArg ? new Date(nowArg) : new Date());
console.log(JSON.stringify({status:result.meetsMinimum ? "PASS" : "FAIL",retentionDays:14,minRecoveryPoints:14,...result}));
if (!result.meetsMinimum) process.exitCode = 1;
