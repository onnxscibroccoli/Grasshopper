#!/usr/bin/env python3
"""Redroid release acceptance: no fake browser/app PASS and no host mutations.

Mode 'live-adb' makes read-only, local-loopback ADB observations. Browser,
companion, accessibility and Termux parity require independent witnessed checks.
Mode 'validate-evidence' admits release only with SHA-256 bound evidence receipts.
"""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
from pathlib import Path
import re
import subprocess
import sys

REQUIRED = {
    "android_boot": "redroid-android16-arm64",
    "adb_private": "adb-loopback",
    "browser_view": "authenticated-browser-screen",
    "browser_input": "browser-keyboard-roundtrip",
    "companion_view": "android-companion-remote-view",
    "companion_input": "android-companion-ime-roundtrip",
    "agent_observe": "semantic-observation-nonempty",
    "agent_execute": "policy-approved-idempotent-action",
    "persist": "android-data-persisted-after-container-restart",
    "reconnect": "browser-and-companion-reconnect",
    "physical_termux": "physical-a14-android15-termux-check",
    "ci_android15": "github-actions-android15-emulator-test",
    "restore": "grasshopper-and-kali-access-after-reboot",
}
STATES = {"PASS", "FAIL", "NOT_PROVEN"}
SHA = re.compile(r"^[a-f0-9]{64}$")
VERSION = re.compile(r"^[a-zA-Z0-9_.:@/-]{1,110}$")
HOST = re.compile(r"^127\.0\.0\.1:[1-9][0-9]{1,4}$")


def validate_observations(obj: dict) -> dict:
    if not isinstance(obj, dict) or obj.get("schema") != "grasshopper.redroid.acceptance/v1":
        raise ValueError("Invalid acceptance schema")
    receipts = obj.get("receipts", {})
    if not isinstance(receipts, dict) or set(receipts) != set(REQUIRED):
        raise ValueError("Missing explicit acceptance receipts")
    errors = []
    for name, kind in REQUIRED.items():
        row = receipts[name]
        if not isinstance(row, dict) or row.get("test_id") != kind:
            errors.append(name + "_test_contract_invalid")
            continue
        if row.get("status") != "PASS":
            errors.append(name + "_not_proven")
            continue
        if not SHA.fullmatch(str(row.get("sha256", ""))):
            errors.append(name + "_missing_sha256")
        if not VERSION.fullmatch(str(row.get("transport", ""))):
            errors.append(name + "_missing_transport")
        if not VERSION.fullmatch(str(row.get("target_version", ""))):
            errors.append(name + "_missing_target_version")
        if row.get("source", "") not in ("github-actions", "oci-local", "physical-android", "human-observer"):
            errors.append(name + "_untrusted_source")
        if row.get("synthetic") is not False:
            errors.append(name + "_synthetic_or_unverified")
    return {"schema": "grasshopper.redroid.release-decision/v1",
            "status": "RELEASE_ELIGIBLE_FOR_REVIEW" if not errors else "BLOCKED",
            "missing_or_untrusted": sorted(errors),
            "receipts_required": len(REQUIRED),
            "receipts_passed": len(REQUIRED) if not errors else 0,
            "production_promoted": False,
            "reboot_authorized": False}


def adb_read(serial: str, args: list[str]) -> tuple[int, str]:
    if not HOST.fullmatch(serial) or not ipaddress.ip_address(serial.split(":")[0]).is_loopback:
        raise ValueError("ADB must use explicit IPv4 loopback only")
    if not args or args[:1] != ["shell"]:
        raise ValueError("Only read-only shell queries authorized")
    allow = [
        ["shell", "getprop", "sys.boot_completed"],
        ["shell", "getprop", "ro.build.version.sdk"],
        ["shell", "getprop", "ro.product.cpu.abi"],
        ["shell", "wm", "size"],
        ["shell", "wm", "density"],
        ["shell", "pm", "path", "com.termux"],
    ]
    if args not in allow:
        raise ValueError("ADB command not allowlisted")
    p = subprocess.run(["adb", "-s", serial, *args], capture_output=True,
                       text=True, timeout=14, check=False)
    return p.returncode, p.stdout.strip()[:600]


def live_adb(serial: str) -> dict:
    commands = {
        "boot": ["shell", "getprop", "sys.boot_completed"],
        "sdk": ["shell", "getprop", "ro.build.version.sdk"],
        "abi": ["shell", "getprop", "ro.product.cpu.abi"],
        "size": ["shell", "wm", "size"],
        "density": ["shell", "wm", "density"],
        "termux": ["shell", "pm", "path", "com.termux"],
    }
    fields = {}
    for name, argv in commands.items():
        try:
            rc, value = adb_read(serial, argv)
            fields[name] = {"status": "PASS" if rc == 0 and bool(value) else "NOT_PROVEN",
                            "value": value if name in ("boot","sdk","abi","size","density")
                            else "PACKAGE_FOUND" if value else "NOT_INSTALLED"}
        except (OSError, ValueError, subprocess.TimeoutExpired):
            fields[name] = {"status": "NOT_PROVEN", "value": "UNAVAILABLE"}
    valid = (fields["boot"]["value"] == "1" and
             fields["sdk"]["value"] == "36" and
             fields["abi"]["value"] == "arm64-v8a" and
             all(fields[n]["status"] == "PASS" for n in ("size", "density")))
    return {"schema": "grasshopper.redroid.adb-observation/v1",
            "serial_class": "loopback_only",
            "target": "redroid-android16-arm64",
            "status": "ADB_BOOT_CHECK_PASS" if valid else "BLOCKED",
            "observations": fields,
            "browser_input_proven": False,
            "companion_input_proven": False,
            "agent_actions_proven": False,
            "physical_termux_parity_proven": False}


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)
    live = sub.add_parser("live-adb")
    live.add_argument("--serial", default="127.0.0.1:5556")
    evidence = sub.add_parser("validate-evidence")
    evidence.add_argument("--file", required=True)
    args = parser.parse_args()
    try:
        if args.mode == "live-adb":
            result = live_adb(args.serial)
        else:
            result = validate_observations(json.loads(Path(args.file).read_text()))
        print(json.dumps(result, sort_keys=True))
        return 0 if result["status"] in ("ADB_BOOT_CHECK_PASS","RELEASE_ELIGIBLE_FOR_REVIEW") else 2
    except (ValueError, OSError, TypeError, json.JSONDecodeError):
        print("REDROID_RELEASE=BLOCKED_INVALID_INPUT", file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
