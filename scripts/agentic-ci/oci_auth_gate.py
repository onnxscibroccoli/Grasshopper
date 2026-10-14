#!/usr/bin/env python3
"""Read-only OCI auth readiness. Tokens and callback URLs are never printed.

On an OCI instance prefer instance principal. If the human's OCI CLI session
has expired, exit AUTH_HANDOFF; do not attempt interactive login in headless CI.
"""
import argparse
import os
import subprocess
import sys

def probe(profile="OMNIKALI", region="us-ashburn-1", timeout=15, runner="oci"):
    # Only pass static, allowlisted CLI arguments; never accept model-provided flags.
    if not profile.replace("_", "").isalnum() or not region.replace("-", "").isalnum():
        raise ValueError("Invalid profile or region")
    for auth in ("instance_principal", "security_token"):
        try:
            args = [runner, "iam", "region", "list", "--auth", auth,
                    "--region", region, "--no-retry", "--output", "json"]
            if auth == "security_token":
                args += ["--profile", profile]
            p = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
            if p.returncode == 0:
                return "AUTH_OK_INSTANCE_PRINCIPAL" if auth == "instance_principal" else "AUTH_OK_INTERACTIVE_SESSION"
        except (OSError, subprocess.TimeoutExpired):
            continue
    return "AUTH_HANDOFF_REQUIRED"

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--profile", default="OMNIKALI")
    p.add_argument("--region", default="us-ashburn-1")
    args=p.parse_args()
    result=probe(args.profile,args.region)
    print("OCI_AUTH_STATUS="+result)
    if result == "AUTH_HANDOFF_REQUIRED":
        print("HUMAN_ACTION=OPEN_GRASSHOPPER_DESKTOP_BROWSER")
        print("REAUTH_COMMAND=oci session authenticate --region us-ashburn-1 --profile-name OMNIKALI")
        print("AUTH_CALLBACK_URL_EXPORTED=NO")
        print("AUTOMATED_DEPLOYMENT=BLOCKED")
        return 3
    print("STATIC_API_KEYS_NEEDED=NO")
    return 0

if __name__=="__main__":
    try:sys.exit(main())
    except ValueError:
        print("OCI_AUTH_STATUS=BLOCKED_INVALID_INPUT",file=sys.stderr);sys.exit(2)
