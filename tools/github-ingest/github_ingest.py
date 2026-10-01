#!/usr/bin/env python3
"""
GitHub repository ingestion/indexing for the OmniKali knowledge system.

Design goals:
- never clone multi-GB blobs just to discover structure
- use partial clone + no checkout
- persist repository/ref/tree manifests
- index paths and small text files for local semantic/keyword retrieval
- keep raw source outside the knowledge graph
- never ingest credentials or secret-looking files
- incremental by commit SHA

Usage:
  python3 tools/github-ingest/github_ingest.py sync onnxscibroccoli/broccoli-core
  python3 tools/github-ingest/github_ingest.py search "chat_store"
  python3 tools/github-ingest/github_ingest.py status
"""
from __future__ import annotations
import argparse, hashlib, json, os, re, sqlite3, subprocess, sys
from pathlib import Path
from datetime import datetime, timezone

DEFAULT_ROOT = Path(os.environ.get("OMNIKALI_GITHUB_INDEX_ROOT", "~/.cache/omnikali/github-index")).expanduser()
MAX_TEXT = int(os.environ.get("OMNIKALI_GITHUB_MAX_TEXT_BYTES", "262144"))
MAX_FILES = int(os.environ.get("OMNIKALI_GITHUB_MAX_FILES", "5000"))
SECRET_NAME = re.compile(r"(^|/)(\.env|.*(secret|token|password|credential|private.?key|github_pat).*)($|/)", re.I)
TEXT_EXT = {".md",".txt",".json",".jsonl",".yaml",".yml",".toml",".ini",".cfg",".conf",".py",".js",".mjs",".ts",".tsx",".sh",".bash",".sql",".html",".css",".xml",".java",".kt",".go",".rs",".rb",".php"}

def run(cmd, cwd=None):
    p = subprocess.run(cmd, cwd=cwd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode:
        raise RuntimeError(f"{' '.join(cmd)}: {p.stderr[-2000:]}")
    return p.stdout

def db(root):
    root.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(root / "index.sqlite")
    c.executescript("""
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS repos(
      repo TEXT PRIMARY KEY, path TEXT NOT NULL, ref TEXT, commit_sha TEXT,
      tree_count INTEGER, indexed_at TEXT, status TEXT
    );
    CREATE TABLE IF NOT EXISTS paths(
      repo TEXT NOT NULL, commit_sha TEXT NOT NULL, path TEXT NOT NULL,
      kind TEXT NOT NULL, size INTEGER, sha TEXT, category TEXT,
      PRIMARY KEY(repo,commit_sha,path)
    );
    CREATE TABLE IF NOT EXISTS content(
      repo TEXT NOT NULL, commit_sha TEXT NOT NULL, path TEXT NOT NULL,
      text TEXT NOT NULL, sha256 TEXT NOT NULL,
      PRIMARY KEY(repo,commit_sha,path)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
      repo, commit_sha, path, text, tokenize='unicode61'
    );
    CREATE INDEX IF NOT EXISTS idx_paths_repo_path ON paths(repo,path);
    """)
    return c

def safe_category(path):
    p = path.lower()
    if SECRET_NAME.search(path): return "PROTECTED"
    if any(x in p for x in ("knowledge","graph","archive","harvest","chat","account","memory")): return "KNOWLEDGE_RELEVANT"
    if any(x in p for x in ("test","fixture","spec")): return "TEST"
    if any(x in p for x in ("workflow",".github/")): return "AUTOMATION"
    if any(x in p for x in ("readme","docs/","roadmap","vision","architecture")): return "DOCUMENTATION"
    if any(x in p for x in ("scripts/","tools/","runtime/","src/","lib/","modules/")): return "IMPLEMENTATION"
    return "OTHER"

def repo_dir(root, repo):
    return root / "repos" / repo.replace("/","__")

def ensure_repo(root, repo):
    dest = repo_dir(root, repo)
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not (dest / ".git").exists():
        run(["git","clone","--filter=blob:none","--no-checkout",
             f"https://github.com/{repo}.git",str(dest)])
    else:
        run(["git","fetch","--filter=blob:none","origin"],cwd=dest)
    return dest

def sync(root, repo, ref="HEAD"):
    owner,name = repo.split("/",1)
    dest = ensure_repo(root, repo)
    sha = run(["git","rev-parse",ref],cwd=dest).strip()
    tree = run(["git","ls-tree","-r","--long",sha],cwd=dest)
    rows=[]
    for line in tree.splitlines():
        parts=line.split(None,4)
        if len(parts)<5: continue
        mode,kind,obj,size,path=parts
        if kind != "blob": continue
        try: size_i=int(size)
        except: size_i=0
        rows.append((repo,sha,path,"blob",size_i,obj,safe_category(path)))
        if len(rows)>=MAX_FILES: break
    c=db(root)
    c.execute("DELETE FROM paths WHERE repo=? AND commit_sha=?",(repo,sha))
    c.executemany("INSERT OR REPLACE INTO paths VALUES(?,?,?,?,?,?,?)",rows)
    text_rows=[]
    for _,_,path,_,size,_,cat in rows:
        if cat=="PROTECTED" or size>MAX_TEXT: continue
        if Path(path).suffix.lower() not in TEXT_EXT and not Path(path).name.lower().startswith(("readme","license")): continue
        try:
            raw=run(["git","show",f"{sha}:{path}"],cwd=dest)
        except Exception:
            continue
        if "\x00" in raw: continue
        digest=hashlib.sha256(raw.encode()).hexdigest()
        text_rows.append((repo,sha,path,raw,digest))
    c.executemany("INSERT OR REPLACE INTO content VALUES(?,?,?,?,?)",text_rows)
    c.execute("DELETE FROM content_fts WHERE repo=? AND commit_sha=?",(repo,sha))
    c.executemany("INSERT INTO content_fts(repo,commit_sha,path,text) VALUES(?,?,?,?)",
                  [(r[0],r[1],r[2],r[3]) for r in text_rows])
    c.execute("INSERT OR REPLACE INTO repos VALUES(?,?,?,?,?,?,?)",
              (repo,str(dest),ref,sha,len(rows),datetime.now(timezone.utc).isoformat(),"OK"))
    c.commit(); c.close()
    manifest={"schema":"github-ingest/v1","repo":repo,"ref":ref,"commit_sha":sha,
              "tree_entries_indexed":len(rows),"text_files_indexed":len(text_rows),
              "protected_paths_excluded":sum(r[-1]=="PROTECTED" for r in rows),
              "indexed_at":datetime.now(timezone.utc).isoformat()}
    (root/"manifests").mkdir(exist_ok=True)
    (root/"manifests"/f"{owner}__{name}__{sha[:12]}.json").write_text(json.dumps(manifest,indent=2))
    print(json.dumps(manifest,indent=2))

def search(root, query, limit=30):
    c=db(root)
    rows=c.execute("""SELECT repo,path,snippet(content_fts,3,'>>>','<<<','…',24)
                      FROM content_fts WHERE content_fts MATCH ? LIMIT ?""",
                   (query,limit)).fetchall()
    for repo,path,snip in rows:
        print(json.dumps({"repo":repo,"path":path,"snippet":snip}))
    print(json.dumps({"count":len(rows),"query":query}))

def status(root):
    c=db(root)
    rows=c.execute("SELECT repo,ref,commit_sha,tree_count,indexed_at,status FROM repos ORDER BY repo").fetchall()
    print(json.dumps([dict(zip(["repo","ref","commit_sha","tree_count","indexed_at","status"],r)) for r in rows],indent=2))

def main():
    ap=argparse.ArgumentParser()
    sub=ap.add_subparsers(dest="cmd",required=True)
    s=sub.add_parser("sync"); s.add_argument("repo"); s.add_argument("--ref",default="HEAD")
    q=sub.add_parser("search"); q.add_argument("query"); q.add_argument("--limit",type=int,default=30)
    sub.add_parser("status")
    a=ap.parse_args(); root=DEFAULT_ROOT
    if a.cmd=="sync": sync(root,a.repo,a.ref)
    elif a.cmd=="search": search(root,a.query,a.limit)
    else: status(root)

if __name__=="__main__": main()
