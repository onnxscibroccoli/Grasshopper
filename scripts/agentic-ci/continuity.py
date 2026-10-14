#!/usr/bin/env python3
"""Cross-run finite-state agentic remediation ledger.

CI cannot run forever. This controller persists an episode between scheduled
runs. It either verifies real success or produces a conclusive handoff.
It NEVER converts failure to PASS, executes model code, or auto-merges.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys

STATUSES = frozenset(("OPEN", "RETRY_ELIGIBLE", "HUMAN_HANDOFF", "AGENT_HANDOFF", "VERIFIED"))
MAX_EPISODE_ROUNDS = 16
MAX_SAME_FINGERPRINT = 3

def fingerprint(s: str) -> str:
    if not isinstance(s, str) or not 1 <= len(s) <= 256:
        raise ValueError("Invalid redacted error class")
    if not re.fullmatch(r"[a-zA-Z0-9_.:-]{1,256}", s):
        raise ValueError("Error must be deidentified machine code")
    return hashlib.sha256(s.encode()).hexdigest()

def transition(previous: dict | None, result: dict) -> dict:
    """Returns a bounded next state. Same-failure loops halt for agent handoff."""
    if not isinstance(result, dict):
        raise ValueError("Result not object")
    code = result.get("outcome")
    if code not in ("PASS", "FAIL", "AUTH_REQUIRED", "BLOCKED", "TRANSIENT"):
        raise ValueError("Unknown outcome")
    if previous is None:
        previous = {"round": 0, "same_fingerprint": 0, "fingerprint": None,
                    "status": "OPEN", "handoff_count": 0}
    if previous.get("status") not in STATUSES:
        raise ValueError("Invalid old status")
    if previous["status"] in ("VERIFIED", "AGENT_HANDOFF", "HUMAN_HANDOFF"):
        # Explicit new episode ID required; do not silently reopen a concluded episode.
        raise ValueError("Concluded episode cannot be reopened")
    n = int(previous.get("round", 0)) + 1
    if n > MAX_EPISODE_ROUNDS:
        return {"round": n, "same_fingerprint": 0, "fingerprint": None,
                "status": "AGENT_HANDOFF", "handoff_reason": "episode_limit",
                "handoff_count": int(previous.get("handoff_count", 0)) + 1}
    if code == "PASS":
        if result.get("all_required_checks_passed") is not True:
            raise ValueError("No PASS without all required checks")
        if result.get("upstream_result") != "success":
            raise ValueError("Cannot mark failing upstream green")
        if result.get("provenance_valid") is not True:
            raise ValueError("No PASS without verified provenance")
        return {"round": n, "same_fingerprint": 0, "fingerprint": None,
                "status": "VERIFIED", "handoff_reason": None,
                "handoff_count": int(previous.get("handoff_count", 0))}
    if code == "AUTH_REQUIRED":
        return {"round": n, "same_fingerprint": 0, "fingerprint": None,
                "status": "HUMAN_HANDOFF", "handoff_reason": "interactive_oauth_needed",
                "handoff_count": int(previous.get("handoff_count", 0)) + 1}
    if code == "BLOCKED":
        return {"round": n, "same_fingerprint": 0, "fingerprint": None,
                "status": "AGENT_HANDOFF", "handoff_reason": "structural_blocker",
                "handoff_count": int(previous.get("handoff_count", 0)) + 1}
    fp = fingerprint(result.get("failure_class", ""))
    same = int(previous.get("same_fingerprint", 0)) + 1 if fp == previous.get("fingerprint") else 1
    if same >= MAX_SAME_FINGERPRINT:
        return {"round": n, "same_fingerprint": same, "fingerprint": fp,
                "status": "AGENT_HANDOFF", "handoff_reason": "repeated_identical_failure",
                "handoff_count": int(previous.get("handoff_count", 0)) + 1}
    return {"round": n, "same_fingerprint": same, "fingerprint": fp,
            "status": "RETRY_ELIGIBLE", "handoff_reason": None,
            "handoff_count": int(previous.get("handoff_count", 0))}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--previous")
    p.add_argument("--result", required=True)
    p.add_argument("--output", required=True)
    args = p.parse_args()
    if Path(args.output).exists():
        raise ValueError("Refusing to overwrite continuity result")
    old = json.loads(Path(args.previous).read_text()) if args.previous else None
    outcome = json.loads(Path(args.result).read_text())
    next_state = transition(old, outcome)
    Path(args.output).write_text(json.dumps(next_state, indent=2) + "\n")
    print("EPISODE_STATE=" + next_state["status"])
    print("NEXT_RUN_ACTION=" + ("recheck_next_schedule" if next_state["status"] == "RETRY_ELIGIBLE"
                                  else "wait_for_handoff" if "HANDOFF" in next_state["status"]
                                  else "none"))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, json.JSONDecodeError, KeyError, TypeError) as error:
        print("CONTINUITY_GATE=BLOCKED_" + type(error).__name__, file=sys.stderr)
        sys.exit(2)
