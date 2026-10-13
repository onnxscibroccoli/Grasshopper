#!/usr/bin/env python3
"""Non-secret human-action checkpoint queue for agentic workflows.

No cloud mutations, browser authentication, credential collection, public
listener, token storage, or false-positive 'authenticated' statuses.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
from pathlib import Path
import re
import sqlite3
import sys
import uuid
from urllib.parse import urlparse

PROVIDERS = {
    "oci": {"cloud.oracle.com", "login.oracle.com"},
    "google": {"accounts.google.com", "console.cloud.google.com"},
    "azure": {"login.microsoftonline.com", "portal.azure.com"},
    "aws": {"console.aws.amazon.com", "signin.aws.amazon.com"},
    "ibm": {"cloud.ibm.com", "login.ibm.com"},
    "github": {"github.com"},
    "cloudflare": {"dash.cloudflare.com"},
    "render": {"dashboard.render.com"},
    "chatgpt": {"chatgpt.com", "auth.openai.com"},
}
ACTIONS = {"login", "signup", "mfa", "permissions", "billing_review", "data_export"}
SUSPECT = re.compile(
    r"(?:access_token|refresh_token|id_token|authorization:|bearer\s+|state=|code=|client_secret|password=|sk-[a-z0-9_-]{8})",
    re.I,
)

def now():
    return dt.datetime.now(dt.timezone.utc)

def validate_origin(provider, origin):
    if provider not in PROVIDERS:
        raise ValueError("Unsupported provider; review the official login origins first")
    parsed = urlparse(origin)
    if (parsed.scheme != "https" or parsed.hostname not in PROVIDERS[provider]
            or parsed.username is not None or parsed.password is not None
            or parsed.port not in (None, 443)
            or parsed.params or parsed.query or parsed.fragment
            or parsed.path not in ("", "/")):
        raise ValueError("Use only the verified vendor HTTPS origin without callback parameters")
    return "https://" + parsed.hostname

def validate_instruction(instruction):
    if not instruction or len(instruction) > 280 or SUSPECT.search(instruction):
        raise ValueError("Instructions must be short and contain no secrets or OAuth callbacks")
    return instruction

def open_database(path):
    path = path.expanduser()
    if path.is_symlink():
        raise ValueError("Refusing symlink database")
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    path.parent.chmod(0o700)
    if path.exists() and (path.stat().st_mode & 0o077):
        raise ValueError("Database permissions must be 0600")
    con = sqlite3.connect(path, timeout=15)
    path.chmod(0o600)
    con.execute("PRAGMA busy_timeout=15000")
    con.execute("PRAGMA journal_mode=DELETE")
    con.execute(
        "CREATE TABLE IF NOT EXISTS handoffs (id TEXT PRIMARY KEY, "
        "idem TEXT UNIQUE, provider TEXT NOT NULL, action TEXT NOT NULL, "
        "origin TEXT NOT NULL, instruction TEXT NOT NULL, state TEXT NOT NULL, "
        "created TEXT NOT NULL, expires TEXT NOT NULL, updated TEXT NOT NULL)"
    )
    con.execute(
        "CREATE TABLE IF NOT EXISTS events (event_id TEXT PRIMARY KEY, "
        "handoff_id TEXT NOT NULL, state TEXT NOT NULL, time TEXT NOT NULL)"
    )
    con.commit()
    return con

FIELDS = ["id", "idem", "provider", "action", "origin", "instruction",
          "state", "created", "expires", "updated"]

def as_record(row):
    return dict(zip(FIELDS, row))

def create(con, provider, action, origin, instruction, idem, ttl):
    origin = validate_origin(provider, origin)
    validate_instruction(instruction)
    if action not in ACTIONS:
        raise ValueError("Unsupported human-action type")
    if not re.fullmatch(r"[a-zA-Z0-9_-]{10,80}", idem):
        raise ValueError("Invalid idempotency key")
    if not 60 <= ttl <= 3600:
        raise ValueError("TTL must be 60–3600 seconds")
    existing = con.execute("SELECT * FROM handoffs WHERE idem=?", (idem,)).fetchone()
    if existing:
        prior = as_record(existing)
        if (prior["provider"], prior["action"], prior["origin"], prior["instruction"]) != (provider, action, origin, instruction):
            raise ValueError("Idempotency key reused with different instructions")
        return prior
    timestamp = now()
    args = (str(uuid.uuid4()), idem, provider, action, origin, instruction,
            "WAITING_USER", timestamp.isoformat(),
            (timestamp + dt.timedelta(seconds=ttl)).isoformat(), timestamp.isoformat())
    with con:
        con.execute("INSERT INTO handoffs VALUES (?,?,?,?,?,?,?,?,?,?)", args)
        con.execute("INSERT INTO events VALUES (?,?,?,?)",
                    (str(uuid.uuid4()), args[0], args[6], args[7]))
    return as_record(args)

def get(con, handoff_id):
    row = con.execute("SELECT * FROM handoffs WHERE id=?", (handoff_id,)).fetchone()
    if not row:
        raise ValueError("Unknown handoff ID")
    return as_record(row)

def transition(con, handoff_id, state, allowed):
    item = get(con, handoff_id)
    if dt.datetime.fromisoformat(item["expires"]) <= now():
        state = "EXPIRED"
    elif item["state"] not in allowed:
        raise ValueError("Transition not permitted from " + item["state"])
    with con:
        con.execute("UPDATE handoffs SET state=?,updated=? WHERE id=?",
                    (state, now().isoformat(), handoff_id))
        con.execute("INSERT INTO events VALUES (?,?,?,?)",
                    (str(uuid.uuid4()), handoff_id, state, now().isoformat()))
    return get(con, handoff_id)

def main(argv=None):
    parser = argparse.ArgumentParser(description="Local non-secret human handoff queue")
    parser.add_argument("--db", type=Path,
                        default=Path.home()/".local/state/grasshopper/handoffs.sqlite")
    commands = parser.add_subparsers(dest="command", required=True)
    p = commands.add_parser("create")
    for name in ("provider", "action", "origin", "instruction", "idempotency-key"):
        p.add_argument("--" + name, required=True)
    p.add_argument("--ttl", type=int, default=900)
    commands.add_parser("list")
    for name in ("show", "confirm", "retry", "block"):
        commands.add_parser(name).add_argument("--id", required=True)
    args = parser.parse_args(argv)
    try:
        with open_database(args.db) as con:
            if args.command == "create":
                result = create(con, args.provider, args.action, args.origin,
                                args.instruction, args.idempotency_key, args.ttl)
            elif args.command == "list":
                result = [{"id": row[0], "provider": row[2], "action": row[3],
                           "state": row[6], "expires": row[8]}
                          for row in con.execute(
                              "SELECT * FROM handoffs ORDER BY created DESC LIMIT 40")]
            elif args.command == "show":
                result = get(con, args.id)
            elif args.command == "confirm":
                if not sys.stdin.isatty():
                    raise ValueError("Confirmation requires a local interactive terminal")
                record = get(con, args.id)
                print("Complete the action ONLY at " + record["origin"])
                print("Action:", record["instruction"])
                print("This is acknowledgement, NOT proof of login or approval to deploy.")
                if input("Type CONFIRM after using the official site: ").strip() != "CONFIRM":
                    raise ValueError("User declined or did not confirm")
                result = transition(con, args.id, "AWAITING_VERIFICATION",
                                    {"WAITING_USER", "NEEDS_RETRY"})
            elif args.command == "retry":
                result = transition(con, args.id, "WAITING_USER",
                                    {"NEEDS_RETRY", "AWAITING_VERIFICATION"})
            elif args.command == "block":
                result = transition(con, args.id, "BLOCKED",
                                    {"WAITING_USER", "NEEDS_RETRY", "AWAITING_VERIFICATION"})
            print(json.dumps(result, indent=2))
            return 0
    except (ValueError, sqlite3.Error) as error:
        print("BLOCKED:", error, file=sys.stderr)
        return 2

if __name__ == "__main__":
    raise SystemExit(main())
