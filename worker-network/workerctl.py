#!/usr/bin/env python3
"""Zero-billable cloud-worker onboarding CLI. Stdlib, Android Termux + CI.

NO infrastructure mutation is implemented. Commands never collect payments or tokens.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import uuid
from typing import Any

HERE = Path(__file__).resolve().parent
CATALOG = HERE / "catalog.json"
SUPPORTED_STATES = (
    "NOT_SELECTED", "NEEDS_ACCOUNT", "NEEDS_USER_AUTH", "AUTH_VERIFIED",
    "NEEDS_FREE_ENTITLEMENT_VERIFICATION", "BLOCKED_BILLABLE",
    "PLAN_READY", "DEPLOYMENT_NOT_IMPLEMENTED"
)


def read_catalog() -> dict[str, Any]:
    data = json.loads(CATALOG.read_text(encoding="utf-8"))
    if data.get("cost_policy") != "zero-billable" or data.get("default_allow_mutations") is not False:
        raise ValueError("Catalog violates zero-billable guardrail")
    for name, entry in data["providers"].items():
        if entry.get("automatic_provisioning") is not False:
            raise ValueError("Forbidden auto-provision flag for " + name)
    return data


def available_providers(cat: dict) -> list[str]:
    return list(cat["providers"])


def resolve_selection(raw: str, cat: dict) -> list[str]:
    names = available_providers(cat)
    if raw.strip().lower() == "all":
        return names
    selected = [p.strip().lower() for p in raw.split(",") if p.strip()]
    invalid = sorted(set(selected) - set(names))
    if invalid or not selected:
        raise ValueError("Invalid provider selection: " + ", ".join(invalid or ["empty"]))
    return list(dict.fromkeys(selected))


def make_plan(selected: list[str], cat: dict) -> dict:
    return {
        "schema_version": 1,
        "created_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "policy": "ZERO_BILLABLE_STRICT",
        "action": "READ_ONLY_PLAN_ONLY",
        "provides_cloud_resource_mutations": False,
        "warning": "An authenticated account is NOT proof of free entitlement."
                   " No cloud resource can be deployed by this version.",
        "providers": [{
            "id": key, "name": cat["providers"][key]["name"],
            "status": "NEEDS_FREE_ENTITLEMENT_VERIFICATION",
            "risk": cat["providers"][key]["risk"],
            "candidate": cat["providers"][key]["offering"],
            "region": cat["providers"][key]["candidate_region"],
            "machine_types": cat["providers"][key]["sizes"],
            "manual_account_url": cat["providers"][key]["account_url"],
            "manual_step": "Open provider console in a trusted browser,"
                " confirm account, free entitlement, spend protection and usage with the provider.",
            "next": "Use workerctl handoff --provider " + key,
            "deploy_authorized": False,
        } for key in selected],
    }


def markdown_plan(plan: dict) -> str:
    lines = [
        "# Multi-cloud onboarding — ZERO BILLABLE PLAN",
        "",
        "**No provider mutations; no billable allocations.** Auth ≠ free entitlement.",
        "",
        "| Provider | Candidate | Region | Gate |",
        "| --- | --- | --- | --- |",
    ]
    for p in plan["providers"]:
        lines.append(f"| {p['name']} | {p['candidate']} | {p['region']} | {p['risk']} |")
    lines += ["", "## Human authorizations", "", "Before any real deployment, complete provider-specific signup, OAuth and account cost controls manually.", "", "## Machine state", "", "`DEPLOYMENT_NOT_IMPLEMENTED` — this toolkit intentionally cannot create paid or free cloud resources yet."]
    return "\n".join(lines) + "\n"


def safe_write(destination: Path, content: str) -> None:
    destination = destination.expanduser()
    destination.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    # Refuse symlinks and already-existing files so an attacker cannot replace config.
    if destination.is_symlink() or destination.exists():
        raise FileExistsError("Refusing to overwrite existing report: " + str(destination))
    fd = os.open(str(destination), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as out:
            out.write(content)
    except BaseException:
        destination.unlink(missing_ok=True)
        raise


def handoff(provider: str, cat: dict) -> str:
    e = cat["providers"][provider]
    lines = [
        f"=== {e['name']}: HUMAN HANDOFF (no secrets) ===",
        "1. Use a trusted browser on the phone or desktop.",
        "2. Review the provider's actual subscription, free credits and billing controls.",
        f"3. Open provider console (generic URL, not an OAuth callback): {e['account_url']}",
        f"4. Read tier policy: {e['docs_url']}",
        "5. Never paste password, device code, OAuth callback URL, payment card, or cloud token in GitHub Actions logs or chats.",
    ]
    if e["auth_command"]:
        lines += [
            "6. After the official CLI is installed, perform INTERACTIVE login *locally*:",
            "   " + shlex.join(e["auth_command"]),
            "7. Confirm current account/region and cost entitlement manually before any provisioning.",
        ]
    else:
        lines.append("6. Authenticate directly in the provider browser; local CLI handoff unavailable in this toolkit.")
    lines += ["", "STATUS=NEEDS_USER_AUTH_OR_ACCOUNT_REVIEW; DEPLOYMENT=BLOCKED"]
    return "\n".join(lines) + "\n"


def verify(provider: str, cat: dict, timeout: int = 25) -> str:
    """Read-only CLI authentication probe. No command output is ever exposed."""
    entry = cat["providers"][provider]
    cmd = entry["verify_command"]
    if cmd is None:
        return "NOT_SUPPORTED_CLI_REVIEW_PROVIDER_CONSOLE"
    if shutil.which(cmd[0]) is None:
        return "CLI_MISSING"
    # Protect CI against accidental network/prompt loops; no user input.
    try:
        done = subprocess.run(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                              stderr=subprocess.DEVNULL, timeout=timeout, check=False)
        return "AUTH_PROBE_PASS_FREE_ELIGIBILITY_UNVERIFIED" if done.returncode == 0 else "AUTH_PROBE_FAIL_OR_EXPIRED"
    except subprocess.TimeoutExpired:
        return "AUTH_PROBE_TIMEOUT"
    except OSError:
        return "AUTH_PROBE_ERROR"


def start_auth(provider: str, cat: dict) -> int:
    # Prevent headless CI OAuth leakage and inadvertent token printing into job logs.
    if os.environ.get("CI", "").lower() in {"true", "1"} or not sys.stdin.isatty() or not sys.stdout.isatty():
        print("BLOCKED: auth requires an interactive terminal, not CI or redirected output.", file=sys.stderr)
        return 3
    e = cat["providers"][provider]
    if not e["auth_command"]:
        print("Use the provider dashboard directly; no supported local login command.")
        return 2
    if shutil.which(e["auth_command"][0]) is None:
        print("CLI unavailable; install using official vendor instructions before OAuth.", file=sys.stderr)
        return 2
    print("Only approve the provider's own login page. Do not share returned tokens or codes.")
    print("This tool does NOT record login output, secrets or cards.")
    print("Starting", provider, "interactive browser/device-code CLI login.")
    return subprocess.call(e["auth_command"])


def create_onboarding(selected: list[str], cat: dict, destination: Path) -> dict:
    """Save *nonsecret* onboarding state for human-authorized resumable steps."""
    entry = {
        "job_id": str(uuid.uuid4()),
        "schema_version": 1,
        "cost_policy": "ZERO_BILLABLE_STRICT",
        "created_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
        "deploy_authorized": False,
        "providers": {p: {"auth_status": "NEEDS_HUMAN_AUTH_OR_ACCOUNT_REVIEW",
                          "eligibility_status": "UNVERIFIED",
                          "deploy_authorized": False} for p in selected}
    }
    safe_write(destination, json.dumps(entry, indent=2) + "\n")
    return entry


def load_onboarding(path: Path, cat: dict) -> dict:
    path = path.expanduser()
    if path.is_symlink() or not path.is_file():
        raise ValueError("Onboarding state missing or symlink")
    if path.stat().st_mode & 0o077:
        raise ValueError("Onboarding file must be private (0600); run chmod 600")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("cost_policy") != "ZERO_BILLABLE_STRICT" or data.get("deploy_authorized") is not False:
        raise ValueError("Onboarding state violates no-spend policy")
    for key, value in data.get("providers", {}).items():
        if key not in cat["providers"] or value.get("deploy_authorized") is not False:
            raise ValueError("Onboarding provider unexpected or unsafe")
    return data


def report_onboarding(data: dict, cat: dict, check: bool = False) -> str:
    lines = ["ONBOARDING_JOB " + data["job_id"], "DEPLOYMENT_BLOCKED=ZERO_BILLABLE_POLICY"]
    for key, state in data["providers"].items():
        auth = verify(key, cat) if check else state.get("auth_status", "UNKNOWN")
        lines.append(f"{key:<12} AUTH={auth}; FREE_ELIGIBILITY={state.get('eligibility_status', 'UNVERIFIED')}; "+
                     f"NEXT=workerctl handoff --provider {key}")
    lines.append("Never paste payment data, OAuth callback links or device codes into CI/chat.")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Offline-first zero-billable multicloud worker coordinator")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("catalog", help="Show free-only catalog. Not a claim of per-account eligibility")
    p = sub.add_parser("plan", help="Write a non-provisioning JSON/Markdown plan")
    p.add_argument("--providers", default="all", help="all or comma-separated provider IDs")
    p.add_argument("--format", choices=["json", "markdown"], default="markdown")
    p.add_argument("--output", type=Path, help="optional new private file, never overwrite")
    p = sub.add_parser("wizard", help="Interactive Android/desktop provider selection; plan only")
    p = sub.add_parser("handoff", help="Explain human browser/CLI signup/auth process")
    p.add_argument("--provider", required=True)
    p = sub.add_parser("verify", help="Read-only CLI auth checks; no tokens printed")
    p.add_argument("--providers", default="all")
    p = sub.add_parser("onboard", help="Create private resumable nonsecret authorization checklist")
    p.add_argument("--providers", required=True)
    p.add_argument("--output", type=Path, required=True, help="new private file; never overwrite")
    p = sub.add_parser("resume", help="Read private checklist and recheck only authenticated CLI state")
    p.add_argument("--file", type=Path, required=True)
    p = sub.add_parser("status", help="Display private checklist without network calls")
    p.add_argument("--file", type=Path, required=True)
    p = sub.add_parser("auth", help="Run provider official OAuth CLI in local TTY; NEVER in CI")
    p.add_argument("--provider", required=True)
    args = parser.parse_args(argv)
    cat = read_catalog()
    try:
        if args.cmd == "catalog":
            for k, v in cat["providers"].items():
                print(f"{k:11} | {v['name']:26} | {v['risk']}")
            return 0
        if args.cmd == "wizard":
            if not sys.stdin.isatty():
                print("Interactive wizard requires a terminal. Use plan --providers ...", file=sys.stderr)
                return 3
            print("Provider IDs:", ", ".join(available_providers(cat)))
            selection = input("Select comma-separated providers, or all: ")
            print(markdown_plan(make_plan(resolve_selection(selection, cat), cat)))
            print("No accounts were changed. Use handoff/auth only in a trusted terminal.")
            return 0
        if args.cmd == "plan":
            result = make_plan(resolve_selection(args.providers, cat), cat)
            content = json.dumps(result, indent=2) + "\n" if args.format == "json" else markdown_plan(result)
            if args.output:
                safe_write(args.output, content)
                print("WROTE_PRIVATE_PLAN", args.output)
            else:
                print(content, end="")
            return 0
        if args.cmd == "handoff":
            if args.provider not in cat["providers"]:
                raise ValueError("Unknown provider")
            print(handoff(args.provider, cat))
            return 0
        if args.cmd == "verify":
            chosen = resolve_selection(args.providers, cat)
            for i, name in enumerate(chosen, 1):
                print(f"STATUS [{i:02}/{len(chosen):02}] {name}: {verify(name, cat)}; DEPLOYMENT_NOT_AUTHORIZED", flush=True)
            return 0
        if args.cmd == "onboard":
            job = create_onboarding(resolve_selection(args.providers, cat), cat, args.output)
            print("PRIVATE_JOB_CREATED", job["job_id"], args.output)
            print(report_onboarding(job, cat))
            return 0
        if args.cmd in {"status", "resume"}:
            data = load_onboarding(args.file, cat)
            print(report_onboarding(data, cat, check=args.cmd == "resume"))
            return 0
        if args.cmd == "auth":
            if args.provider not in cat["providers"]:
                raise ValueError("Unknown provider")
            return start_auth(args.provider, cat)
    except (ValueError, FileExistsError) as exc:
        print("BLOCKED:", str(exc), file=sys.stderr)
        return 2
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
