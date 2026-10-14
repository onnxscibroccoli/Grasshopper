#!/usr/bin/env python3
"""Read-only post-workflow Ollama diagnosis for all matched workflow_run events.

Fetches job metadata and bounded log tails; never checks out upstream PR code,
executes model output, reruns upstream jobs, requests secrets, or edits source.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

from ollama_selftest import diagnose, scrub

API = "https://api.github.com"
ALLOWED_CONCLUSIONS = {"failure", "timed_out", "cancelled", "action_required",
                       "startup_failure", "stale", "skipped", "neutral", "success"}
REPO = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
MAX_JOBS = 4


def get_api(path: str, token: str, accept: str = "application/vnd.github+json") -> bytes:
    req = urllib.request.Request(API + path, headers={
        "Authorization": "Bearer " + token,
        "Accept": accept,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "broccoli-ollama-ci-observatory",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read(160_001)
    if len(data) > 160_000:
        raise ValueError("Oversized GitHub response")
    return data


def job_listing(repo: str, run_id: int, token: str) -> list[dict]:
    raw = get_api(f"/repos/{repo}/actions/runs/{run_id}/jobs?per_page=100", token)
    obj = json.loads(raw)
    if not isinstance(obj, dict):
        raise ValueError("Expected jobs response")
    jobs = obj.get("jobs", [])
    if not isinstance(jobs, list):
        raise ValueError("Malformed jobs response")
    # Relevant failure steps only. Explicit cap limits HTTP calls and model cost.
    return [j for j in jobs if j.get("conclusion") in ("failure", "timed_out",
                                                        "cancelled", "action_required")][:MAX_JOBS]


def classify_job(repo: str, job: dict, token: str) -> dict:
    jid = job.get("id")
    if not isinstance(jid, int) or jid < 1:
        return {"status": "NOT_PROVEN", "category": "unknown", "remedy": "none"}
    try:
        log = get_api(f"/repos/{repo}/actions/jobs/{jid}/logs", token,
                      accept="application/vnd.github+json")
        # Redaction occurs before the model prompt; raw job logs are not emitted.
        tail = scrub(log.decode("utf-8", errors="replace"), 4000)
        result = diagnose(tail, attempts=0)
        category = result.get("category", "unknown").lower()
        if category not in ("network", "dependency", "code", "infrastructure",
                            "transient", "timeout", "unknown", "test_failure",
                            "lint", "other"):
            category = "other"
        # Diagnostics are NOT an instruction to rerun or mutate an upstream job.
        return {"status": "INFERRED_REVIEW_REQUIRED",
                "category": category,
                "remedy": result.get("remedy") if result.get("remedy") in
                          ("retry", "npm_ci", "none") else "none",
                "engine": result.get("source") if result.get("source") in
                          ("ollama", "fallback") else "fallback"}
    except (ValueError, OSError, TimeoutError, urllib.error.URLError,
            UnicodeError, json.JSONDecodeError):
        return {"status": "NOT_PROVEN", "category": "unknown", "remedy": "none"}


def summarize(repo: str, run_id: int, conclusion: str, token: str) -> dict:
    if not REPO.fullmatch(repo):
        raise ValueError("Invalid repository identifier")
    if not isinstance(run_id, int) or run_id <= 0:
        raise ValueError("Invalid run ID")
    if conclusion not in ALLOWED_CONCLUSIONS:
        raise ValueError("Unexpected workflow conclusion")
    jobs = job_listing(repo, run_id, token)
    summary = {
        "schema": "broccoli.ci.workflow-observer/v1",
        "workflow_result": conclusion,
        "original_workflow_still_failed": conclusion != "success",
        "jobs_examined": len(jobs),
        "diagnostics": [],
        "source_patches_applied": False,
        "upstream_job_replayed": False,
        "new_permissions_granted": False,
        "source_read_from_raw_sha": False,
    }
    for job in jobs:
        # No job title (may contain personal data), no paths, no logs, no IDs.
        summary["diagnostics"].append(classify_job(repo, job, token))
    return summary


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--repository", required=True)
    p.add_argument("--run-id", required=True, type=int)
    p.add_argument("--conclusion", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise ValueError("Read-only GitHub Actions token required")
    report = summarize(args.repository, args.run_id, args.conclusion, token)
    with open(args.output, "x", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        f.write("\n")
    os.chmod(args.output, 0o600)
    print("WORKFLOW_OBSERVER_RESULT=REVIEW_REQUIRED")
    print("FAILED_JOBS_CLASSIFIED=" + str(report["jobs_examined"]))
    print("AUTOMATED_UPSTREAM_RERUNS=NONE")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, urllib.error.URLError) as exc:
        print("WORKFLOW_OBSERVER_BLOCKED=" + type(exc).__name__, file=sys.stderr)
        raise SystemExit(2)
