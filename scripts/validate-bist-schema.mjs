#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const STATUS = new Set(["PASS", "FAIL", "NOT_PROVEN", "NOT_APPLICABLE"]);
const OVERALL = new Set(["PASS", "PASS_WITH_NOT_PROVEN", "FAIL"]);
const ID = /^[a-z0-9]+([._-][A-Za-z0-9._/-]+)*$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function fail(errors, path, message) {
  errors.push(`${path}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateBistReport(report) {
  const errors = [];
  if (!isObject(report)) {
    return ["$: report must be an object"];
  }
  if (report.schema !== "omnikali-bist/v1") {
    fail(errors, "/schema", "must equal omnikali-bist/v1");
  }
  if (typeof report.timestamp !== "string" || !ISO.test(report.timestamp)) {
    fail(errors, "/timestamp", "must be an RFC 3339 UTC timestamp");
  }
  if (!Array.isArray(report.checks) || report.checks.length < 1) {
    fail(errors, "/checks", "must be a non-empty array");
  } else {
    report.checks.forEach((check, index) => {
      const base = `/checks/${index}`;
      if (!isObject(check)) {
        fail(errors, base, "must be an object");
        return;
      }
      if (typeof check.id !== "string" || !ID.test(check.id)) {
        fail(errors, `${base}/id`, "must be a dotted BIST identifier");
      }
      if (!STATUS.has(check.status)) {
        fail(errors, `${base}/status`, "must be PASS|FAIL|NOT_PROVEN|NOT_APPLICABLE");
      }
      if (typeof check.detail !== "string") {
        fail(errors, `${base}/detail`, "must be a string");
      }
      if ("blocking" in check && typeof check.blocking !== "boolean") {
        fail(errors, `${base}/blocking`, "must be a boolean");
      }
    });
  }
  if (!isObject(report.summary)) {
    fail(errors, "/summary", "must be an object");
  } else {
    for (const key of ["pass", "fail", "not_proven", "not_applicable"]) {
      if (!Number.isInteger(report.summary[key]) || report.summary[key] < 0) {
        fail(errors, `/summary/${key}`, "must be a non-negative integer");
      }
    }
  }
  if (!OVERALL.has(report.overall)) {
    fail(errors, "/overall", "must be PASS|PASS_WITH_NOT_PROVEN|FAIL");
  }
  if (isObject(report.summary) && Array.isArray(report.checks)) {
    const counted = {
      pass: report.checks.filter((c) => c.status === "PASS").length,
      fail: report.checks.filter((c) => c.status === "FAIL").length,
      not_proven: report.checks.filter((c) => c.status === "NOT_PROVEN").length,
      not_applicable: report.checks.filter((c) => c.status === "NOT_APPLICABLE").length
    };
    for (const key of Object.keys(counted)) {
      if (report.summary[key] !== counted[key]) {
        fail(errors, `/summary/${key}`, `must equal number of ${key} checks (${counted[key]})`);
      }
    }
    const blockingFail = report.checks.some((c) => c.status === "FAIL" && c.blocking !== false);
    if (blockingFail && report.overall !== "FAIL") {
      fail(errors, "/overall", "must be FAIL when a blocking check is FAIL");
    }
  }
  return errors;
}

export function validateBistEvidence(evidence) {
  const errors = [];
  if (!isObject(evidence)) {
    return ["$: evidence must be an object"];
  }
  if (typeof evidence.acceptanceId !== "string" || evidence.acceptanceId.trim() === "") {
    fail(errors, "/acceptanceId", "must be a non-empty string");
  }
  if (!isObject(evidence.checks) || Object.keys(evidence.checks).length < 1) {
    fail(errors, "/checks", "must be a non-empty object");
  } else {
    for (const [id, entry] of Object.entries(evidence.checks)) {
      if (!ID.test(id)) fail(errors, `/checks/${id}`, "invalid check id");
      if (!isObject(entry) || !STATUS.has(entry.status)) {
        fail(errors, `/checks/${id}/status`, "must be PASS|FAIL|NOT_PROVEN|NOT_APPLICABLE");
      }
    }
  }
  return errors;
}

function main(argv) {
  const kind = argv[0];
  const file = argv[1];
  if (!kind || !file || !["report", "evidence"].includes(kind)) {
    console.error("usage: node scripts/validate-bist-schema.mjs <report|evidence> <file.json>");
    process.exitCode = 2;
    return;
  }
  const value = JSON.parse(readFileSync(resolve(file), "utf8"));
  const errors = kind === "report" ? validateBistReport(value) : validateBistEvidence(value);
  if (errors.length) {
    console.error("BIST SCHEMA INVALID");
    for (const error of errors) console.error(` - ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`BIST SCHEMA OK (${kind})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2));
}
