#!/usr/bin/env python3
"""Durable SQLite/FTS index for the Broccoli archive journal.
Raw page files remain authoritative. SQLite is a rebuildable derived index.
Protected content is quarantined and never inserted into searchable message text.
"""
from __future__ import annotations
import hashlib,json,os,re,sqlite3,sys
from pathlib import Path
from typing import Any

PROTECTED_PATTERNS=[
    re.compile(r"(?i)\b(sk-[A-Za-z0-9_-]{20,}|xai-[A-Za-z0-9_-]{20,})\b"),
    re.compile(r"(?i)\b(bearer\s+[A-Za-z0-9._-]{20,})\b"),
    re.compile(r"(?i)\b(password|passwd|secret|private[_ -]?key|access[_ -]?token|refresh[_ -]?token)\s*[:=]\s*\S+"),
]
SCHEMA="archive-v1"

def protected(text:str)->bool:
    return any(p.search(text or "") for p in PROTECTED_PATTERNS)

def db_path(root:Path)->Path:
    return root/"index.sqlite"

def init_db(root:Path)->sqlite3.Connection:
    root.mkdir(parents=True,exist_ok=True)
    c=sqlite3.connect(db_path(root))
    c.executescript("""
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS accounts(
      account_id TEXT PRIMARY KEY, provider TEXT NOT NULL, metadata_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects(
      project_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider TEXT NOT NULL, metadata_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations(
      conversation_id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider TEXT NOT NULL,
      project_id TEXT, title TEXT, created_at TEXT, updated_at TEXT, source_hash TEXT NOT NULL,
      metadata_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages(
      message_id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, account_id TEXT NOT NULL,
      provider TEXT NOT NULL, role TEXT NOT NULL, author TEXT, timestamp TEXT,
      content_hash TEXT NOT NULL, protected INTEGER NOT NULL DEFAULT 0,
      source_page TEXT NOT NULL, metadata_json TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS message_fts USING fts5(
      message_id UNINDEXED, content, provider UNINDEXED, account_id UNINDEXED,
      conversation_id UNINDEXED, role UNINDEXED
    );
    CREATE TABLE IF NOT EXISTS indexed_pages(
      page_id TEXT PRIMARY KEY, page_hash TEXT NOT NULL, indexed_at TEXT NOT NULL
    );
    """)
    c.commit()
    return c

def index(root:Path)->dict[str,Any]:
    pages=sorted((root/"pages").glob("page-*.json"))
    c=init_db(root); pages_seen=0; messages_seen=0; quarantined=0
    for p in pages:
        try: page=json.loads(p.read_text())
        except Exception: continue
        pid=str(page.get("page_id")); ph=str(page.get("page_hash",""))
        old=c.execute("SELECT page_hash FROM indexed_pages WHERE page_id=?",(pid,)).fetchone()
        if old and old[0]==ph: continue
        for m in page.get("messages",[]):
            mid=str(m.get("message_id",""))
            if not mid: continue
            content=str(m.get("content",""))
            is_prot=bool(m.get("protected")) or protected(content)
            provider=str(m.get("metadata",{}).get("provider","other"))
            account=str(m.get("metadata",{}).get("account_id","unknown"))
            conv=str(m.get("conversation_id","unknown"))
            project=m.get("metadata",{}).get("project_id")
            c.execute("INSERT OR IGNORE INTO accounts VALUES(?,?,?)",(account,provider,json.dumps({"source":"page"})))
            if project:
                c.execute("INSERT OR IGNORE INTO projects VALUES(?,?,?,?)",(str(project),account,provider,"{}"))
            c.execute("INSERT OR REPLACE INTO messages VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                      (mid,conv,account,provider,str(m.get("role","unknown")),str(m.get("author","")),
                       str(m.get("timestamp","")),str(m.get("content_hash") or hashlib.sha256(content.encode()).hexdigest()),
                       int(is_prot),str(p),json.dumps(m.get("metadata",{}),ensure_ascii=False)))
            c.execute("DELETE FROM message_fts WHERE message_id=?",(mid,))
            if is_prot:
                quarantined+=1
            else:
                c.execute("INSERT INTO message_fts VALUES(?,?,?,?,?,?)",(mid,content,provider,account,conv,str(m.get("role","unknown"))))
            messages_seen+=1
        c.execute("INSERT OR REPLACE INTO indexed_pages VALUES(?,?,datetime('now'))",(pid,ph)); pages_seen+=1
        c.commit()
    c.close()
    return {"schema":SCHEMA,"pages_indexed":pages_seen,"messages_indexed":messages_seen,"quarantined":quarantined,"db":str(db_path(root))}

def search(root:Path,q:str,limit:int=20)->list[dict[str,Any]]:
    c=init_db(root)
    rows=c.execute("""SELECT m.provider,m.account_id,m.conversation_id,m.message_id,m.role,m.timestamp,
                      m.source_page, f.content
                      FROM message_fts f JOIN messages m ON m.message_id=f.message_id
                      WHERE message_fts MATCH ? LIMIT ?""",(q,limit)).fetchall()
    c.close()
    return [{"provider":r[0],"account_id":r[1],"conversation_id":r[2],"message_id":r[3],
             "role":r[4],"timestamp":r[5],"source_page":r[6],"snippet":r[7][:400]} for r in rows]

if __name__=="__main__":
    root=Path(os.environ.get("BROCCOLI_ARCHIVE_ROOT","./archive-journal"))
    if len(sys.argv)>1 and sys.argv[1]=="search":
        print(json.dumps({"query":sys.argv[2],"hits":search(root,sys.argv[2])},indent=2))
    else:
        print(json.dumps(index(root),indent=2))
