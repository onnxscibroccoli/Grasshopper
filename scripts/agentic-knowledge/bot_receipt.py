#!/usr/bin/env python3
"""Append a private, scrubbed bot action receipt. Never logs inputs or tokens."""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import re
import sys

TARGETS = {"local-android", "cloud-android", "linux", "browser", "mcp-api"}
STATES = {"STARTED", "MILESTONE", "WAITING_FOR_HUMAN", "FAILED", "VERIFIED"}
SLUG = re.compile(r"^[a-z][a-z0-9-]{2,80}$")
ID = re.compile(r"^[A-Za-z0-9_.:-]{8,128}$")

def validate(obj):
    if not isinstance(obj, dict):
        raise ValueError("Expected JSON object")
    allowed = {"bot_id", "request_id", "idempotency_key", "device_target",
               "milestone", "state", "acceptance_id", "error_class"}
    if set(obj) - allowed:
        raise ValueError("Unapproved fields; never log arguments or secrets")
    if not SLUG.fullmatch(obj.get("bot_id", "")):
        raise ValueError("Invalid bot ID")
    for key in ("request_id", "idempotency_key"):
        if not ID.fullmatch(obj.get(key, "")):
            raise ValueError("Invalid request token metadata")
    if obj.get("device_target") not in TARGETS or obj.get("state") not in STATES:
        raise ValueError("Unknown target or state")
    for key in ("milestone", "acceptance_id", "error_class"):
        val = obj.get(key, "")
        if not isinstance(val, str) or (val and not SLUG.fullmatch(val)):
            raise ValueError("Only controlled vocabulary slugs allowed")
    return {**obj, "observed_at": dt.datetime.now(dt.timezone.utc).isoformat(),
            "schema": "broccoli.bot.receipt/v1"}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--private-dir", required=True)
    args = p.parse_args()
    data = validate(json.load(sys.stdin))
    root = Path(args.private_dir).resolve()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(root, 0o700)
    # No symlinks or world-readable published workspace.
    target = root / "bot-receipts.jsonl"
    if target.is_symlink():
        raise ValueError("Symlink receipt path forbidden")
    fd = os.open(target, os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        with os.fdopen(fd, "a", encoding="utf8") as stream:
            fcntl.flock(stream, fcntl.LOCK_EX)
            stream.write(json.dumps(data, sort_keys=True) + "\n")
            stream.flush()
            os.fsync(stream.fileno())
            fcntl.flock(stream, fcntl.LOCK_UN)
    finally:
        pass
    print("BOT_RECEIPT_WRITTEN=PRIVATE")

if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, json.JSONDecodeError) as e:
        print("BOT_RECEIPT_REJECTED=" + type(e).__name__, file=sys.stderr)
        sys.exit(2)
