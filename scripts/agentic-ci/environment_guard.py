#!/usr/bin/env python3
"""Reject environment deployment without GitHub required-reviewer protection."""
import argparse
import json
import os
import sys
import urllib.request
from urllib.error import URLError, HTTPError

def has_reviewers(info: dict) -> bool:
    if not isinstance(info,dict):
        return False
    rules=info.get("protection_rules",[])
    return any(isinstance(r,dict) and r.get("type")=="required_reviewers"
               and bool(r.get("reviewers")) for r in rules)

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--repo",required=True)
    p.add_argument("--environment",required=True)
    a=p.parse_args()
    token=os.environ.get("GITHUB_TOKEN","")
    if not token or a.environment!="oci-grasshopper-production":
        print("HITL_PROTECTION=BLOCKED_MISSING_TOKEN_OR_ENV");return 2
    if not a.repo or "/" not in a.repo:
        print("HITL_PROTECTION=BLOCKED_INVALID_REPO");return 2
    url="https://api.github.com/repos/"+a.repo+"/environments/"+a.environment
    req=urllib.request.Request(url,headers={
        "Authorization":"Bearer "+token,
        "Accept":"application/vnd.github+json",
        "X-GitHub-Api-Version":"2022-11-28"})
    try:
        with urllib.request.urlopen(req,timeout=18) as r:
            info=json.load(r)
    except (HTTPError,URLError,TimeoutError,ValueError):
        print("HITL_PROTECTION=BLOCKED_UNREADABLE");return 2
    if not has_reviewers(info):
        print("HITL_PROTECTION=BLOCKED_NO_REQUIRED_REVIEWERS");return 2
    print("HITL_PROTECTION=VERIFIED_REQUIRED_REVIEWERS")
    print("HITL_APPROVAL=ONLY_VIA_GITHUB_ENVIRONMENT_REVIEW")
    return 0

if __name__=="__main__":sys.exit(main())
