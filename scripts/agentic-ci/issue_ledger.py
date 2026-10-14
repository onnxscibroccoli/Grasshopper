#!/usr/bin/env python3
"""Update the deidentified GitHub Issue continuity ledger from one CI check.

No model-generated commands, log publication, arbitrary source modifications,
or deployment. At conclusive agent handoff create a clean branch from main.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request
import urllib.error
from pathlib import Path

from continuity import transition
from ollama_selftest import diagnose, scrub

START = "<!-- broccoli-continuity-v1"
END = "-->"
BASE = "https://api.github.com"
CHECK = ["python3", "-m", "unittest", "discover", "-s", "test/agentic_ci",
         "-p", "test_*.py", "-v"]

def request(method, path, token, body=None):
    headers={"Authorization":"Bearer "+token,"Accept":"application/vnd.github+json",
             "X-GitHub-Api-Version":"2022-11-28"}
    req=urllib.request.Request(BASE+path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers,method=method)
    with urllib.request.urlopen(req,timeout=30) as f:
        return json.load(f)

def old_state(body):
    match=re.search(r"<!-- broccoli-continuity-v1\s*\n(\{[^\n]+\})\s*\n-->",body)
    if not match:
        raise ValueError("Trusted continuity marker missing")
    return json.loads(match.group(1))

def update_body(body, state, run_url, branch_status="NO_BRANCH_CHANGE"):
    # Limit issue growth; replace only the machine-readable marker and a bounded summary.
    marker=START+"\n"+json.dumps(state,sort_keys=True,separators=(",",":"))+"\n"+END
    replaced=re.sub(r"<!-- broccoli-continuity-v1\s*\n\{[^\n]+\}\s*\n-->",
                    lambda _:marker,body,count=1)
    if replaced==body:
        raise ValueError("Failed marker replacement")
    header=replaced.split("\n## Latest CI checkpoint")[0]
    safe_url=run_url if re.fullmatch(r"https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/\d+",run_url) else "NOT_AVAILABLE"
    return header+"\n## Latest CI checkpoint\n\n"+(
        f"- Status: \`{state['status']}\`\n"
        f"- Round: \`{state['round']}\`\n"
        f"- Handoff reason: \`{state.get('handoff_reason') or 'none'}\`\n"
        f"- Branch initiation: \`{branch_status}\`\n"
        f"- [CI evidence run]({safe_url})\n"
        "- No passwords, tokens, logs or model prose were published.\n")

def branch_from_main(repo, run_id, token):
    # Branch creation only, never a commit, PR merge or deployment.
    path="/repos/"+repo
    ref=request("GET",path+"/git/ref/heads/main",token)
    sha=ref.get("object",{}).get("sha")
    if not isinstance(sha,str) or not re.fullmatch("[a-f0-9]{40}",sha):
        return "MAIN_REF_UNAVAILABLE"
    new="refs/heads/agentic/remediation-"+str(run_id)
    try:
        request("POST",path+"/git/refs",token,{"ref":new,"sha":sha})
        return "CLEAN_FEATURE_BRANCH_CREATED"
    except urllib.error.HTTPError:
        return "BRANCH_CREATION_DENIED_HANDOFF_RETAINS_ISSUE"

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--issue-number",type=int,required=True)
    p.add_argument("--repository",required=True)
    p.add_argument("--run-id",type=int,required=True)
    args=p.parse_args()
    token=os.getenv("GITHUB_TOKEN","")
    if not token or not re.fullmatch("[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+",args.repository):
        raise ValueError("Token/repository invalid")
    if args.issue_number<=0 or args.run_id<=0:
        raise ValueError("Missing issue or run id")
    endpoint=f"/repos/{args.repository}/issues/{args.issue_number}"
    issue=request("GET",endpoint,token)
    state=old_state(issue.get("body",""))
    if state.get("status") in ("VERIFIED","AGENT_HANDOFF","HUMAN_HANDOFF"):
        print("CONTINUITY=ALREADY_CONCLUDED")
        return 0
    # Never infer green from the LLM. The unit suite's real exit status decides.
    result=subprocess.run(CHECK,capture_output=True,text=True,timeout=360)
    outcome={"outcome":"PASS" if result.returncode==0 else "FAIL",
             "all_required_checks_passed":result.returncode==0,
             "upstream_result":"success" if result.returncode==0 else "failure",
             "provenance_valid":bool(os.getenv("GITHUB_SHA")),
             "failure_class":"ci_harness_tests_failed"}
    if result.returncode != 0:
        diagnosis=diagnose(scrub(result.stdout+"\n"+result.stderr,3200),attempts=0)
        if diagnosis.get("remedy")=="retry":
            rerun=subprocess.run(CHECK,capture_output=True,text=True,timeout=360)
            if rerun.returncode==0:
                outcome={"outcome":"PASS","all_required_checks_passed":True,
                         "upstream_result":"success",
                         "provenance_valid":bool(os.getenv("GITHUB_SHA")),
                         "failure_class":"transient_recovered"}
            # Never make a failing run green after a failed retest.
    next_state=transition(state,outcome)
    branch_status="NO_BRANCH_CHANGE"
    if next_state["status"]=="AGENT_HANDOFF":
        branch_status=branch_from_main(args.repository,args.run_id,token)
    url=f"https://github.com/{args.repository}/actions/runs/{args.run_id}"
    body=update_body(issue["body"],next_state,url,branch_status)
    request("PATCH",endpoint,token,{"body":body})
    print("CONTINUITY_STATUS="+next_state["status"])
    print("CONTINUITY_ROUND="+str(next_state["round"]))
    print("MODEL_COMMANDS_EXECUTED=NO")
    print("PUBLIC_LOGS_WRITTEN=NO")
    return 0 if next_state["status"]=="VERIFIED" else 1 if next_state["status"]=="RETRY_ELIGIBLE" else 2

if __name__=="__main__":
    try:sys.exit(main())
    except (ValueError, OSError, subprocess.TimeoutExpired, urllib.error.URLError,
            KeyError, TypeError, json.JSONDecodeError) as e:
        print("CONTINUITY_CONTROLLER=BLOCKED_"+type(e).__name__,file=sys.stderr)
        sys.exit(2)
