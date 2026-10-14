#!/usr/bin/env python3
"""Post-main empirical observatory lineage check; no source or state mutation."""
import argparse
import datetime as dt
import json
import os
import sys
import urllib.request
import urllib.parse
from urllib.error import HTTPError, URLError

CANARY = "Ollama CI failure canary"
OBSERVER = "Ollama CI Observatory"

def timestamp(value):
    if not isinstance(value, str) or not value:
        raise ValueError("Missing timestamp")
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))

def api(repo, path, token):
    req = urllib.request.Request("https://api.github.com/repos/"+repo+path,
                                 headers={"Authorization":"Bearer "+token,
                                          "Accept":"application/vnd.github+json",
                                          "X-GitHub-Api-Version":"2022-11-28"})
    with urllib.request.urlopen(req,timeout=22) as r:
        return json.load(r)

def evaluate(canary: dict, runs: list[dict], now: dt.datetime) -> dict:
    if (canary.get("name") != CANARY or canary.get("conclusion") != "failure"
        or canary.get("head_branch") != "main"
        or canary.get("event") != "workflow_dispatch"):
        raise ValueError("Canary must be a failed mainline manual test")
    start = timestamp(canary["updated_at"])
    if (now-start).total_seconds() < 180:
        raise ValueError("Observation window not yet complete (180s)")
    related = []
    for run in runs:
        if run.get("name") != OBSERVER or run.get("event") != "workflow_run":
            continue
        when = timestamp(run.get("created_at"))
        if start <= when <= start+dt.timedelta(minutes=3):
            related.append(run)
    if len(related) != 1:
        raise ValueError("Must observe exactly one matching observer run")
    observer = related[0]
    if observer.get("status") != "completed" or observer.get("conclusion") not in ("success", "skipped"):
        raise ValueError("Observer must terminate cleanly")
    # Never treat a skipped observatory as evidence that failure was diagnosed.
    if observer.get("conclusion") != "success":
        raise ValueError("Observer did not execute diagnostics")
    return {
        "schema":"broccoli.ci.zero-recursion-proof/v1",
        "canary_run_id":str(canary["id"]),
        "observer_run_id":str(observer["id"]),
        "observed_observers":len(related),
        "no_recursive_children_in_window":True,
        "proof_window_seconds":180,
        "status":"PASS_WITH_FINITE_OBSERVATION_WINDOW",
        "limitation":"Cannot mathematically guarantee infinite future behavior.",
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--repository",required=True)
    p.add_argument("--canary-id",type=int,required=True)
    p.add_argument("--output",required=True)
    args=p.parse_args()
    token=os.getenv("GITHUB_TOKEN")
    if not token or args.canary_id<1:
        raise ValueError("Read-only GitHub token and real canary run required")
    canary=api(args.repository,f"/actions/runs/{args.canary_id}",token)
    start=timestamp(canary.get("updated_at"))
    begin=(start-dt.timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
    end=(start+dt.timedelta(minutes=4)).strftime("%Y-%m-%dT%H:%M:%SZ")
    query=urllib.parse.urlencode({"event":"workflow_run","created":begin+".."+end,"per_page":100})
    obj=api(args.repository,"/actions/runs?"+query,token)
    if obj.get("total_count",0)>100:
        raise ValueError("Insufficient pagination; cannot certify no recursion")
    proof=evaluate(canary,obj.get("workflow_runs",[]),dt.datetime.now(dt.timezone.utc))
    out=args.output
    if os.path.exists(out):raise ValueError("Proof already exists")
    with open(out,"x",encoding="utf8") as f:
        json.dump(proof,f,indent=2)
        f.write("\n")
    print("ZERO_RECURSION_LIVE="+proof["status"])
    print("CANARY_ID="+str(args.canary_id))
    return 0

if __name__=="__main__":
    try:sys.exit(main())
    except (ValueError, OSError, KeyError, TypeError, HTTPError, URLError) as ex:
        print("ZERO_RECURSION_LIVE=BLOCKED_"+type(ex).__name__,file=sys.stderr)
        sys.exit(2)
