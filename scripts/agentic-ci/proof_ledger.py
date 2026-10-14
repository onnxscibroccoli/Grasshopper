#!/usr/bin/env python3
"""Tamper-evident SHA-256 proof manifest, never a substitute for tests.

A manifest may be emitted only with explicit proof-gate input; uploading to
GitHub artifacts is integrity evidence but NOT permanent immutable WORM storage.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import sys

HEX = re.compile(r"^[a-f0-9]{64}$")
REPO = re.compile(r"^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$")
SAFE_NAME = re.compile(r"^[a-zA-Z0-9_.-]{1,100}$")

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for blob in iter(lambda: f.read(1048576), b""):
            h.update(blob)
    return h.hexdigest()

def create(path: Path, output: Path, repo: str, run_id: str, ref: str,
           tests_passed: bool, recursion_proof: bool) -> dict:
    if not tests_passed or not recursion_proof:
        raise ValueError("Cannot issue clearance without both acceptance gates")
    if not REPO.fullmatch(repo) or not run_id.isdecimal() or ref != "refs/heads/main":
        raise ValueError("Proof requires authorized canonical main run identity")
    if path.is_symlink() or not path.is_file() or path.stat().st_size <= 0:
        raise ValueError("Verified output must exist, be regular and nonempty")
    if not SAFE_NAME.fullmatch(path.name):
        raise ValueError("Unsafe output artifact name")
    if output.exists() or output.is_symlink() or not output.parent.is_dir():
        raise ValueError("Refusing proof overwrite")
    item_hash = sha256(path)
    doc = {"schema": "broccoli.oci.proof/v1",
           "source_ref": "main", "repository": repo, "run_id": run_id,
           "output_file": path.name, "sha256": item_hash,
           "gate": {"all_tests_passed": True, "zero_recursion_verified": True},
           "utc": dt.datetime.now(dt.timezone.utc).isoformat(),
           "binding": "sha256(file-bytes) with filename and origin recorded; artifact retention is finite",
           "object_storage_write": "NOT_PERFORMED",
           "worm_retention": "NOT_PROVEN"}
    output.write_text(json.dumps(doc, sort_keys=True, indent=2) + "\n")
    os.chmod(output, 0o600)
    return doc

def verify(path: Path, artifact: Path) -> bool:
    info = json.loads(artifact.read_text())
    if info.get("schema") != "broccoli.oci.proof/v1" or not HEX.fullmatch(info.get("sha256", "")):
        return False
    if path.name != info.get("output_file") or path.is_symlink() or not path.is_file():
        return False
    return (sha256(path) == info["sha256"] and info.get("gate") ==
            {"all_tests_passed": True, "zero_recursion_verified": True})

def main():
    p=argparse.ArgumentParser()
    sub=p.add_subparsers(dest="cmd", required=True)
    c=sub.add_parser("create")
    c.add_argument("--file", required=True); c.add_argument("--output", required=True)
    c.add_argument("--repo", required=True); c.add_argument("--run-id", required=True)
    c.add_argument("--ref", required=True)
    c.add_argument("--tests-passed", action="store_true")
    c.add_argument("--recursion-proven", action="store_true")
    v=sub.add_parser("verify")
    v.add_argument("--file", required=True); v.add_argument("--manifest", required=True)
    args=p.parse_args()
    try:
        if args.cmd=="create":
            doc=create(Path(args.file),Path(args.output),args.repo,args.run_id,args.ref,
                       args.tests_passed,args.recursion_proven)
            print("PROOF_SHA256="+doc["sha256"])
            print("PROOF_LEVEL=GATED_MANIFEST_NOT_WORM")
        else:
            if not verify(Path(args.file),Path(args.manifest)):
                print("PROOF_VERIFIED=NO")
                return 2
            print("PROOF_VERIFIED=YES")
        return 0
    except (ValueError,OSError,json.JSONDecodeError,TypeError) as e:
        print("PROOF_GATE=BLOCKED_"+type(e).__name__,file=sys.stderr)
        return 2

if __name__=="__main__":
    sys.exit(main())
