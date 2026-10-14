#!/usr/bin/env python3
"""Fail-closed workflow_run lineage/recursion guard.

This guards the diagnostic event. The observer never dispatches another
workflow. Success requires actual upstream tests, never this predicate alone.
"""
import argparse
import json
import os
from pathlib import Path
import sys

OBSERVER_NAMES = frozenset({
    "Ollama CI Observatory",
    "Reusable read-only Ollama CI failure observer",
    "Ollama self-test continuity controller",
    "Ollama CI pre-activation canary",
    "Ollama CI activation gate",
})
MAX_CHAIN_HOPS = 1

def decide(event: dict, observer: str = "Ollama CI Observatory") -> dict:
    run = event.get("workflow_run")
    if not isinstance(run, dict):
        return {"allowed": False, "reason": "missing_workflow_run", "hop": 0}
    origin = str(run.get("name", ""))
    trigger = str(run.get("event", ""))
    actor_obj = run.get("actor") or {}
    actor = str(actor_obj.get("login", "")) if isinstance(actor_obj, dict) else ""
    head = str(run.get("head_branch", ""))
    conclusion = str(run.get("conclusion", ""))
    run_id = run.get("id")
    event_action = str(event.get("action", ""))
    lineage = event.get("client_payload", {}) or {}
    if not isinstance(lineage, dict):
        lineage = {}
    try:
        hops = int(lineage.get("observer_hops", 0))
    except (TypeError, ValueError):
        hops = MAX_CHAIN_HOPS + 1
    blocked_reason = ""
    if event_action != "completed":
        blocked_reason = "not_completed"
    elif type(run_id) is not int or run_id <= 0:
        blocked_reason = "invalid_run_id"
    elif origin in OBSERVER_NAMES or origin == observer or "ollama ci observatory" in origin.lower():
        blocked_reason = "observer_self_trigger"
    elif trigger in ("workflow_run", "repository_dispatch"):
        blocked_reason = "nested_workflow_event"
    elif hops != 0:
        blocked_reason = "nonzero_lineage_hop"
    elif actor == "github-actions[bot]" and trigger in ("workflow_dispatch", "repository_dispatch"):
        blocked_reason = "bot_dispatch_event"
    elif conclusion not in ("failure", "timed_out", "cancelled", "action_required"):
        blocked_reason = "no_failure_to_diagnose"
    elif not origin or not head:
        blocked_reason = "missing_provenance"
    return {
        "allowed": not bool(blocked_reason),
        "reason": blocked_reason or "first_generation_failure_only",
        "hop": 1 if not blocked_reason else 0,
        "upstream_run_id": run_id if type(run_id) is int else None,
        "action": "diagnose_only" if not blocked_reason else "no_action",
        "may_dispatch": False,
        "may_mark_source_success": False,
    }

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--event", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()
    event_path = Path(args.event)
    target = Path(args.output)
    if target.exists() or target.is_symlink():
        raise ValueError("Refuse to overwrite lineage result")
    result = decide(json.loads(event_path.read_text(encoding="utf8")))
    # Never include source event, actor, branch, tokens, paths or logs.
    target.write_text(json.dumps(result, sort_keys=True) + "\n")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf8") as f:
            f.write("allowed=" + str(result["allowed"]).lower() + "\n")
    print("LINEAGE_GATE=" + ("ALLOW" if result["allowed"] else "BLOCK"))
    print("LINEAGE_REASON=" + result["reason"])
    return 0 if result["allowed"] else 2

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, json.JSONDecodeError):
        print("LINEAGE_GATE=BLOCK")
        sys.exit(2)
