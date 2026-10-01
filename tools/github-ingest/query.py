#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,os,sqlite3
from pathlib import Path
DEFAULT_ROOT=Path(os.environ.get("OMNIKALI_GITHUB_INDEX_ROOT","~/.cache/omnikali/github-index")).expanduser()
def query(root,q,limit=20):
 db=root/"index.sqlite"
 if not db.exists(): raise RuntimeError("GitHub evidence index does not exist: "+str(db))
 c=sqlite3.connect(db)
 rows=c.execute("""SELECT f.repo,f.commit_sha,f.path,p.sha,p.category,snippet(content_fts,3,'>>>','<<<','…',32) FROM content_fts f JOIN paths p ON p.repo=f.repo AND p.commit_sha=f.commit_sha AND p.path=f.path WHERE content_fts MATCH ? ORDER BY f.repo,f.path LIMIT ?""",(q,limit)).fetchall(); c.close()
 return {"query":q,"limit":limit,"hit_count":len(rows),"hits":[{"repository":r[0],"commit_sha":r[1],"path":r[2],"blob_sha":r[3],"category":r[4],"snippet":r[5],"provenance":{"source":"github","repository":r[0],"commit":r[1],"path":r[2],"blob":r[3]}} for r in rows]}
def main():
 ap=argparse.ArgumentParser(); ap.add_argument("query"); ap.add_argument("--root",default=str(DEFAULT_ROOT)); ap.add_argument("--limit",type=int,default=20); a=ap.parse_args()
 if a.limit<1 or a.limit>100: raise SystemExit("--limit must be 1..100")
 print(json.dumps(query(Path(a.root),a.query,a.limit),ensure_ascii=False,indent=2))
if __name__=="__main__": main()
