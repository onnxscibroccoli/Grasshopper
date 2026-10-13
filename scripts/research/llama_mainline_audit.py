#!/usr/bin/env python3
"""Local Llama analysis: main-only source topics + merged-main history metadata."""
import argparse
import collections
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from urllib.request import urlopen, Request

ALLOW = {"Grasshopper", "broccoli-core", "omn-kali-knowledge-graph-master", "helix", "kali-node"}
FILES = ("README.md", "AGENTS.md", "BASE_SYSTEM_PROTECTION.md",
         "docs/redroid-implementation-log.md",
         "docs/OMNIKALI_SYSTEM_GOALS_GRAPH_2026-10-01.md",
         "docs/BROCCOLI_TRANSPORT_CONTRACT_2026-10-01.md")
TOPICS = "android redroid binder qemu linux kali accessibility semantic rish mcp oauth provider model api event governance governor recovery tests scripts workflow rustdesk novnc cloud automation bot kernel".split()
BLOCK = [
    r"(?i)[\w.+-]+@[\w.-]+\.[a-z]{2,}",
    r"(?<!\d)(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}(?!\d)",
    r"(?i)ocid1\.[a-z0-9.]+", r"(?i)https?://", r"(?i)-----BEGIN",
    r"(?i)(?:token|password|secret)\s*[:=]", r"(?i)/home/[^/\s]+/",
    r"\b(?:\d{1,3}\.){3}\d{1,3}\b", r"[A-Za-z0-9+/=_-]{75,}",
]
def private(text):
    return any(re.search(p, text) for p in BLOCK)

def git(args, cwd=None):
    p = subprocess.run(["git", "-c", "core.hooksPath=/dev/null", *args],
                       cwd=cwd, capture_output=True, text=True, timeout=120,
                       env={**os.environ, "GIT_TERMINAL_PROMPT": "0", "GIT_LFS_SKIP_SMUDGE": "1"})
    if p.returncode:
        raise RuntimeError("Main-only Git operation failed (details withheld)")
    return p.stdout

def collect(repo, root):
    # No checkout by SHA, no unmerged branches, no historical patch/text reads.
    history = git(["log", "main", "--first-parent", "--max-count=100",
                   "--format=DAY:%cs", "--numstat"], cwd=root)
    months, areas = collections.Counter(), collections.Counter()
    for row in history.splitlines():
        if row.startswith("DAY:"):
            day = row[4:]
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
                months[day[:7]] += 1
        elif len(row.split("\t")) == 3:
            path = row.split("\t", 2)[2]
            area = ("docs" if path.startswith("docs/") else
                    "tests" if path.startswith(("test/", "tests/")) else
                    "scripts" if path.startswith("scripts/") else
                    "workflows" if path.startswith(".github/workflows/") else "other")
            areas[area] += 1
    evid = []
    for rel in FILES:
        file = root / rel
        if not file.is_file() or file.is_symlink() or file.stat().st_size > 200000:
            continue
        text = file.read_text(errors="replace").lower()
        topics = {word: len(re.findall(r"\b" + word + r"\b", text)) for word in TOPICS}
        evid.append({"id": "E" + str(len(evid) + 1), "ref": repo + "@main:" + rel,
                     "topics": {k: v for k, v in topics.items() if v}})
    return {"repo": repo, "months": dict(months), "areas": dict(areas), "evidence": evid}

def analyze(data):
    prompt = ("You are an architecture researcher. Analyze only the deidentified topic "
              "counts of current main documents and activity statistics from merged main "
              "history. History is not proof of success. Give a cautious, evidence-linked "
              "JSON object with findings, gaps, milestones, bots. Each field is a list of "
              "objects {claim, evidence_ids}. For bots also include preconditions, "
              "actions, verification, rollback. IDs MUST come from the E index. "
              "Never assert completion, invent identifiers, copy source or output private "
              "information. All bots are UNVERIFIED candidates. Milestones replace "
              "constant monitoring. DATA=" + json.dumps(data))
    req = Request("http://127.0.0.1:11434/api/generate", data=json.dumps({
        "model": "llama3.2:1b-instruct-q4_K_M", "prompt": prompt,
        "stream": False, "format": "json", "options": {"temperature": 0, "num_predict": 900},
    }).encode(), headers={"Content-Type": "application/json"})
    with urlopen(req, timeout=240) as response:
        answer = json.loads(json.load(response)["response"])
    if not isinstance(answer, dict):
        raise ValueError("Invalid model response")
    allowed = {e["id"] for e in data["evidence"]}
    clean = {}
    for category in ("findings", "gaps", "milestones", "bots"):
        records = answer.get(category, [])
        if not isinstance(records, list):
            raise ValueError("Invalid response list")
        clean[category] = []
        for item in records[:12]:
            if not isinstance(item, dict):
                continue
            refs = item.get("evidence_ids", [])
            if not isinstance(refs, list) or not refs or any(r not in allowed for r in refs):
                continue
            item["status"] = "UNVERIFIED_BOT" if category == "bots" else "INFERRED"
            if private(json.dumps(item)):
                raise ValueError("Privacy gate blocked model output")
            clean[category].append(item)
    return clean

def render(data, proposals):
    lines = ["# Mainline Llama research: " + data["repo"], "",
             "Draft/inferred only. No private data, source excerpts or raw historical snapshots.",
             "Merged-main history trends do not establish working software.", "",
             "## Source references (current main)"]
    lines += ["- " + x["id"] + " " + x["ref"] +
              " | topics: " + ", ".join(x["topics"]) for x in data["evidence"]]
    lines += ["", "## Historical mainline trend", "Months: " + json.dumps(data["months"]),
              "Changed areas: " + json.dumps(data["areas"])]
    for group in ("findings", "gaps", "milestones", "bots"):
        lines += ["", "## " + group]
        for item in proposals[group]:
            lines.append("- " + str(item.get("claim", "Not stated")) +
                         " [evidence " + ", ".join(item["evidence_ids"]) +
                         "; " + item["status"] + "]")
    report = "\n".join(lines) + "\n"
    if private(report):
        raise ValueError("Privacy gate blocked artifact")
    return report

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repositories", required=True)
    p.add_argument("--out", required=True, type=Path)
    a = p.parse_args()
    names = [r.strip() for r in a.repositories.split(",")]
    if not (1 <= len(names) <= 5) or len(set(names)) != len(names) or any(x not in ALLOW for x in names):
        raise SystemExit("Repository allowlist violation")
    a.out.mkdir(mode=0o700, parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="llama-main-") as tmp:
        for name in names:
            target = Path(tmp) / name
            git(["clone", "--quiet", "--single-branch", "--branch", "main",
                 "--depth", "120", "https://github.com/onnxscibroccoli/" + name + ".git",
                 str(target)])
            if git(["branch", "--show-current"], cwd=target).strip() != "main":
                raise RuntimeError("Not on main")
            data = collect(name, target)
            if not data["evidence"]:
                raise RuntimeError("No admissible evidence")
            draft = render(data, analyze(data))
            output = a.out / (name + "-research-review.md")
            output.write_text(draft)
            os.chmod(output, 0o600)
            print("MILESTONE=" + name + " HUMAN_REVIEW_REQUIRED")
    print("COMPLETE=UNVERIFIED_DRAFTS NO_COMMITS=YES")

if __name__ == "__main__":
    main()
