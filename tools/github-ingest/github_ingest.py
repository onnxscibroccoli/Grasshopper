#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,os,re,sqlite3,subprocess
from pathlib import Path
from datetime import datetime,timezone

ROOT=Path(os.environ.get("OMNIKALI_GITHUB_INDEX_ROOT","~/.cache/omnikali/github-index")).expanduser()
MAX_TEXT=int(os.environ.get("OMNIKALI_GITHUB_MAX_TEXT_BYTES","262144"))
MAX_PATHS=int(os.environ.get("OMNIKALI_GITHUB_MAX_PATHS","20000"))
MAX_TEXT_FILES=int(os.environ.get("OMNIKALI_GITHUB_MAX_TEXT_FILES","300"))
SECRET=re.compile(r"(^|/)(\.env|.*(secret|token|password|credential|private.?key|github_pat).*)($|/)",re.I)
EXT={".md",".txt",".json",".jsonl",".yaml",".yml",".toml",".ini",".cfg",".conf",".py",".js",".mjs",".ts",".tsx",".sh",".bash",".sql",".html",".css",".xml",".java",".kt",".go",".rs",".rb",".php"}

def run(cmd,cwd=None):
    p=subprocess.run(cmd,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode: raise RuntimeError(f"{' '.join(cmd)}: {p.stderr[-2000:]}")
    return p.stdout

def db():
    ROOT.mkdir(parents=True,exist_ok=True); c=sqlite3.connect(ROOT/"index.sqlite")
    c.executescript("""PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS repos(repo TEXT PRIMARY KEY,path TEXT,ref TEXT,commit_sha TEXT,tree_count INTEGER,indexed_at TEXT,status TEXT);
CREATE TABLE IF NOT EXISTS paths(repo TEXT,commit_sha TEXT,path TEXT,kind TEXT,size INTEGER,sha TEXT,category TEXT,PRIMARY KEY(repo,commit_sha,path));
CREATE TABLE IF NOT EXISTS content(repo TEXT,commit_sha TEXT,path TEXT,text TEXT,sha256 TEXT,PRIMARY KEY(repo,commit_sha,path));
CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(repo,commit_sha,path,text,tokenize='unicode61');
CREATE INDEX IF NOT EXISTS idx_paths_repo_path ON paths(repo,path);"""); return c

def category(path):
    p=path.lower()
    if SECRET.search(path): return "PROTECTED"
    if any(x in p for x in ("knowledge","graph","archive","harvest","chat","account","memory")): return "KNOWLEDGE_RELEVANT"
    if any(x in p for x in ("test","fixture","spec")): return "TEST"
    if any(x in p for x in ("workflow",".github/")): return "AUTOMATION"
    if any(x in p for x in ("readme","docs/","roadmap","vision","architecture")): return "DOCUMENTATION"
    if any(x in p for x in ("scripts/","tools/","runtime/","src/","lib/","modules/")): return "IMPLEMENTATION"
    return "OTHER"

def repo_dir(repo): return ROOT/"repos"/repo.replace("/","__")

def ensure(repo):
    d=repo_dir(repo); d.parent.mkdir(parents=True,exist_ok=True)
    if not (d/".git").exists():
        run(["git","clone","--filter=blob:none","--no-checkout",f"https://github.com/{repo}.git",str(d)])
    else:
        run(["git","fetch","--filter=blob:none","--no-tags","origin"],cwd=d)
    return d

def sync(repo,ref="HEAD"):
    d=ensure(repo); sha=run(["git","rev-parse",ref],cwd=d).strip()
    rows=[]
    for line in run(["git","ls-tree","-r","--long",sha],cwd=d).splitlines():
        parts=line.split(None,4)
        if len(parts)<5 or parts[1]!="blob": continue
        _,_,obj,size,path=parts
        try:size_i=int(size)
        except ValueError:size_i=0
        rows.append((repo,sha,path,"blob",size_i,obj,category(path)))
        if len(rows)>=MAX_PATHS: break
    c=db(); c.execute("DELETE FROM paths WHERE repo=? AND commit_sha=?",(repo,sha))
    c.executemany("INSERT OR REPLACE INTO paths VALUES(?,?,?,?,?,?,?)",rows)
    pri={"KNOWLEDGE_RELEVANT":0,"DOCUMENTATION":1,"IMPLEMENTATION":2,"AUTOMATION":3,"TEST":4,"OTHER":5,"PROTECTED":99}
    cand=sorted((r for r in rows if r[-1]!="PROTECTED" and r[4]<=MAX_TEXT and
                 (Path(r[2]).suffix.lower() in EXT or Path(r[2]).name.lower().startswith(("readme","license")))),
                key=lambda r:(pri[r[-1]],len(r[2])))[:MAX_TEXT_FILES]
    texts=[]
    for _,_,path,_,_,_,_ in cand:
        try: raw=run(["git","show",f"{sha}:{path}"],cwd=d)
        except Exception: continue
        if "\x00" in raw: continue
        texts.append((repo,sha,path,raw,hashlib.sha256(raw.encode()).hexdigest()))
    c.executemany("INSERT OR REPLACE INTO content VALUES(?,?,?,?,?)",texts)
    c.execute("DELETE FROM content_fts WHERE repo=? AND commit_sha=?",(repo,sha))
    c.executemany("INSERT INTO content_fts(repo,commit_sha,path,text) VALUES(?,?,?,?)",[(r[0],r[1],r[2],r[3]) for r in texts])
    now=datetime.now(timezone.utc).isoformat()
    c.execute("INSERT OR REPLACE INTO repos VALUES(?,?,?,?,?,?,?)",(repo,str(d),ref,sha,len(rows),now,"OK")); c.commit(); c.close()
    m={"schema":"github-ingest/v1","repo":repo,"ref":ref,"commit_sha":sha,"tree_entries_indexed":len(rows),
       "text_files_indexed":len(texts),"protected_paths_excluded":sum(r[-1]=="PROTECTED" for r in rows),"indexed_at":now}
    (ROOT/"manifests").mkdir(exist_ok=True); (ROOT/"manifests"/f'{repo.replace("/","__")}__{sha[:12]}.json').write_text(json.dumps(m,indent=2)); print(json.dumps(m,indent=2))

def search(q,limit=30):
    c=db(); rows=c.execute("""SELECT repo,path,snippet(content_fts,3,'>>>','<<<','…',24)
FROM content_fts WHERE content_fts MATCH ? LIMIT ?""",(q,limit)).fetchall()
    for repo,path,snip in rows: print(json.dumps({"repo":repo,"path":path,"snippet":snip}))
    print(json.dumps({"count":len(rows),"query":q}))

def status():
    c=db(); rows=c.execute("SELECT repo,ref,commit_sha,tree_count,indexed_at,status FROM repos ORDER BY repo").fetchall()
    print(json.dumps([dict(zip(["repo","ref","commit_sha","tree_count","indexed_at","status"],r)) for r in rows],indent=2))

ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest="cmd",required=True)
s=sub.add_parser("sync"); s.add_argument("repo"); s.add_argument("--ref",default="HEAD")
q=sub.add_parser("search"); q.add_argument("query"); q.add_argument("--limit",type=int,default=30)
sub.add_parser("status"); a=ap.parse_args()
if a.cmd=="sync": sync(a.repo,a.ref)
elif a.cmd=="search": search(a.query,a.limit)
else: status()
