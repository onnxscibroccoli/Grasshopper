#!/usr/bin/env python3
"""Calculate pre-job CI time budgets, 2-5x expected runtime, fail-closed.

GitHub job timeouts cannot be extended after the job starts. This script
calculates a bounded budget BEFORE dependent jobs are scheduled, using the
configured expected duration and (when available) successful mainline job
durations from read-only GitHub Actions metadata. Never raises past 360m.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import statistics
import sys
import urllib.error
import urllib.parse
import urllib.request

MAX_HISTORY_RUNS = 6
MAX_API_BYTES = 2_000_000
WORKFLOW_RE = re.compile(r"^[a-z][a-z0-9_-]+\.yml$")
REPO_RE = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def duration_minutes(started: str, completed: str) -> float | None:
    try:
        a = dt.datetime.fromisoformat(started.replace("Z", "+00:00"))
        b = dt.datetime.fromisoformat(completed.replace("Z", "+00:00"))
        seconds = (b - a).total_seconds()
        return seconds / 60 if 0 < seconds < 24 * 3600 else None
    except (TypeError, ValueError, AttributeError):
        return None


def api(path: str, token: str) -> dict:
    req = urllib.request.Request("https://api.github.com" + path, headers={
        "Authorization": "Bearer " + token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "grasshopper-ci-timeout-planner",
    })
    with urllib.request.urlopen(req, timeout=10) as response:
        raw = response.read(MAX_API_BYTES + 1)
    if len(raw) > MAX_API_BYTES:
        raise ValueError("GitHub API response oversized")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError("Unexpected GitHub metadata shape")
    return payload


def recent_successful_job_durations(repo: str, workflow: str, token: str) -> dict[str, list[float]]:
    """Read only successful, completed mainline runs; failure durations are excluded."""
    if not REPO_RE.fullmatch(repo) or not WORKFLOW_RE.fullmatch(workflow):
        raise ValueError("Unsafe repository or workflow identifier")
    url = f"/repos/{repo}/actions/workflows/{workflow}/runs?"
    query = urllib.parse.urlencode({"branch": "main", "status": "success", "per_page": MAX_HISTORY_RUNS})
    runs = api(url + query, token).get("workflow_runs", [])
    if not isinstance(runs, list):
        raise ValueError("Invalid Actions runs response")
    samples: dict[str, list[float]] = {}
    for run in runs[:MAX_HISTORY_RUNS]:
        if not isinstance(run, dict) or run.get("conclusion") != "success":
            continue
        rid = run.get("id")
        if type(rid) is not int or rid < 1:
            continue
        entries = api(f"/repos/{repo}/actions/runs/{rid}/jobs?per_page=100", token).get("jobs", [])
        if not isinstance(entries, list):
            raise ValueError("Invalid Jobs metadata")
        for j in entries:
            if not isinstance(j, dict) or j.get("conclusion") != "success":
                continue
            name = j.get("name")
            if not isinstance(name, str) or len(name) > 180:
                continue
            elapsed = duration_minutes(j.get("started_at"), j.get("completed_at"))
            if elapsed is not None:
                samples.setdefault(name, []).append(elapsed)
    return samples


def percentile_75(data: list[float]) -> float:
    xs = sorted(data)
    return xs[max(0, math.ceil(len(xs) * .75) - 1)]


def calculate(policy: dict, workflow: str, history: dict[str, list[float]] | None = None) -> dict[str, int]:
    if policy.get("schema") != "broccoli.ci.dynamic-time-budget/v1":
        raise ValueError("Unrecognized timeout policy")
    if not WORKFLOW_RE.fullmatch(workflow):
        raise ValueError("Invalid workflow name")
    definitions = policy.get("workflows")
    if not isinstance(definitions, dict) or workflow not in definitions:
        raise ValueError("Workflow not registered; no fallback to 360-minute default")
    rows = definitions[workflow]
    if not isinstance(rows, dict) or not rows:
        raise ValueError("Missing job duration baselines")
    max_minutes = policy.get("platform_max_minutes")
    min_factor, max_factor = policy.get("min_factor"), policy.get("max_factor")
    min_samples = policy.get("minimum_historical_samples")
    if (max_minutes != 360 or min_factor != 2 or max_factor != 5 or
        type(min_samples) is not int or not 3 <= min_samples <= MAX_HISTORY_RUNS):
        raise ValueError("Invalid bounded policy controls")
    budgets: dict[str, int] = {}
    for key, info in rows.items():
        if not re.fullmatch(r"[a-z][a-z0-9-]{1,75}", key) or not isinstance(info, dict):
            raise ValueError("Invalid job identifier or settings")
        baseline, factor, label = (info.get("expected_minutes"), info.get("multiplier"),
                                   info.get("job_name"))
        if (type(baseline) is not int or not 1 <= baseline <= 175
            or type(factor) not in (float, int) or not min_factor <= factor <= max_factor
            or not isinstance(label, str) or not 1 <= len(label) <= 180):
            raise ValueError("Out-of-range expected time or multiplier")
        samples = history.get(label, []) if history else []
        valid = [v for v in samples if isinstance(v, (int, float)) and not isinstance(v, bool)
                 and math.isfinite(v) and 0 < v <= 1440]
        expected = max(baseline, percentile_75(valid) if len(valid) >= min_samples else baseline)
        budget = min(max_minutes, math.ceil(expected * factor))
        if not baseline * 2 <= budget <= max_minutes:
            raise ValueError("Computed budget violates safety envelope")
        budgets[key] = int(budget)
    return budgets


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--workflow", required=True)
    p.add_argument("--config", default="config/agentic-ci-time-budgets.json")
    p.add_argument("--history-json", help="Offline deterministic fixture; never used with live API")
    args = p.parse_args()
    policy = json.loads(Path(args.config).read_text(encoding="utf-8"))
    hist: dict[str, list[float]] = {}
    source = "DECLARED_BASELINE"
    if args.history_json:
        hist = json.loads(Path(args.history_json).read_text())
        source = "TEST_FIXTURE"
    else:
        token, repo = os.getenv("GITHUB_TOKEN"), os.getenv("GITHUB_REPOSITORY")
        if token and repo:
            try:
                hist = recent_successful_job_durations(repo, args.workflow, token)
                source = "SUCCESSFUL_MAINLINE_RUNS" if hist else "DECLARED_BASELINE"
            except (ValueError, OSError, TimeoutError, urllib.error.URLError,
                    json.JSONDecodeError):
                # Metadata outages do not grant infinite timeout. Use reviewed baselines.
                source = "METADATA_UNAVAILABLE_REVIEWED_BASELINE"
    budgets = calculate(policy, args.workflow, hist)
    text = json.dumps(budgets, sort_keys=True, separators=(",", ":"))
    output_path = os.getenv("GITHUB_OUTPUT")
    if output_path:
        with open(output_path, "a", encoding="utf-8") as f:
            f.write("budgets=" + text + "\n")
    print("CI_BUDGET_POLICY=2X_TO_5X_EXPECTED")
    print("CI_BUDGET_SOURCE=" + source)
    print("CI_BUDGET_MAX_JOB_MINUTES=360")
    print("CI_BUDGET_JOB_COUNT=" + str(len(budgets)))
    print("CI_BUDGETS=" + text)
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, TypeError, json.JSONDecodeError) as err:
        print("CI_BUDGET=BLOCKED_" + type(err).__name__, file=sys.stderr)
        sys.exit(2)
