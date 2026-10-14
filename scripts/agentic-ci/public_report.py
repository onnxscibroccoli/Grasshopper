#!/usr/bin/env python3
"""Emit a public-safe diagnostic summary; excludes all model prose and raw logs."""
import argparse
import json
import os
from pathlib import Path
import sys

STATUS = {"PASS", "PASS_AFTER_RETRY", "FAIL", "BLOCKED_UPSTREAM", "BLOCKED_INPUT"}
REMEDY = {"retry", "npm_ci", "none"}
SOURCE = {"ollama", "fallback"}
CATEGORY = {"network", "dependency", "code", "infrastructure", "transient",
            "timeout", "unknown", "test_failure", "lint", "other"}

def reduce_report(data):
    status = data.get("status")
    if status not in STATUS:
        raise ValueError("Unknown result")
    rows = []
    for attempt in data.get("attempts", []):
        if not isinstance(attempt, dict):
            raise ValueError("Malformed attempt")
        row = {
            "attempt": int(attempt["attempt"]),
            "exit_code": int(attempt["exit_code"]),
            "output_contract_ok": bool(attempt.get("output_contract_ok", False)),
        }
        diag = attempt.get("diagnosis")
        if diag:
            classification = str(diag.get("category", "unknown")).strip().lower()
            row["diagnostic_class"] = classification if classification in CATEGORY else "other"
            remedy = diag.get("remedy", "none")
            row["remedy"] = remedy if remedy in REMEDY else "none"
            src = diag.get("source", "fallback")
            row["diagnostic_engine"] = src if src in SOURCE else "fallback"
        rows.append(row)
    return {
        "schema": "broccoli.ci.selftest.public-review/v1",
        "status": status,
        "upstream_ok": bool(data.get("upstream_ok", False)),
        "source_mutated": bool(data.get("source_mutated", False)),
        "attempts": rows,
        "patch_applied": False,
        "review_required": bool(data.get("human_review_required", True)),
        "full_log_exported": False,
        "model_prompt_exported": False,
        "credentials_exported": False,
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()
    dest = Path(args.output)
    if dest.exists() or dest.is_symlink():
        raise ValueError("Public report output already exists")
    report = reduce_report(json.loads(Path(args.input).read_text()))
    with dest.open("x", encoding="utf-8") as f:
        json.dump(report, f, indent=2, sort_keys=True)
        f.write("\n")
    os.chmod(dest, 0o600)
    print("PUBLIC_SELFTEST_REDACTION=PASS")
    print("PUBLIC_SELFTEST_STATUS=" + report["status"])

if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as exc:
        print("PUBLIC_REPORT_FAILED=" + type(exc).__name__, file=sys.stderr)
        sys.exit(2)
