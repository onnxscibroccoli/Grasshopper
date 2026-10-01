#!/usr/bin/env python3
import json, os, sqlite3, subprocess, sys, urllib.request
from pathlib import Path

ROOT=Path(os.environ.get("GRASSHOPPER_DIR","/opt/omnikali/src/Grasshopper"))
BROCCOLI=Path(os.environ.get("BROCCOLI_DIR","/opt/omnikali/src/broccoli-core"))
STATE=Path(os.environ.get("STATE_DIR","/var/lib/omnikali"))
EXPECTED_G=os.environ.get("EXPECTED_GRASSHOPPER_COMMIT","")
EXPECTED_B=os.environ.get("EXPECTED_BROCCOLI_COMMIT","")

def fail(message):
    print("GCP_VERIFY_FAIL: "+message, file=sys.stderr)
    raise SystemExit(1)

def git(path, *args):
    return subprocess.check_output(["git","-C",str(path),*args], text=True).strip()

if not (ROOT/".git").is_dir(): fail("Grasshopper checkout missing")
if not (BROCCOLI/".git").is_dir(): fail("Broccoli Core checkout missing")
manifest=STATE/"worker-source.json"
if not manifest.is_file(): fail("source manifest missing")

req=urllib.request.Request(
    "http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip",
    headers={"Metadata-Flavor":"Google"})
try:
    with urllib.request.urlopen(req, timeout=5) as r:
        fail("external IPv4 detected: HTTP "+str(r.status))
except urllib.error.HTTPError as e:
    if e.code != 404: fail("metadata external-IP probe returned HTTP "+str(e.code))
except Exception as e:
    fail("metadata external-IP probe failed: "+str(e))

g=git(ROOT,"rev-parse","HEAD")
b=git(BROCCOLI,"rev-parse","HEAD")
if EXPECTED_G and g != EXPECTED_G: fail("Grasshopper commit mismatch")
if EXPECTED_B and b != EXPECTED_B: fail("Broccoli Core commit mismatch")

env=os.environ.copy()
env["OMNIKALI_GITHUB_INDEX_ROOT"]=str(STATE/"github-index")
subprocess.run(["npm","test"],cwd=ROOT,env=env,check=True)
subprocess.run([sys.executable,"-m","py_compile","tools/github-ingest/github_ingest.py","tools/github-ingest/query.py"],cwd=ROOT,check=True)
subprocess.run([sys.executable,"tools/github-ingest/query.py","archive","--limit","3"],cwd=ROOT,env=env,check=True,stdout=subprocess.DEVNULL)
db=STATE/"github-index"/"index.sqlite"
if not db.is_file(): fail("GitHub evidence index missing")
with sqlite3.connect(db) as c:
    if c.execute("PRAGMA integrity_check").fetchone()[0] != "ok": fail("SQLite integrity check failed")

p=json.loads(manifest.read_text())
for key in ("schema","grasshopper_commit","broccoli_commit","node","architecture"):
    if not p.get(key): fail("manifest missing "+key)
if p.get("external_ipv4") is not False: fail("manifest external_ipv4 is not false")
if p.get("github_api_only") is not True: fail("manifest github_api_only is not true")

print("GCP_WORKER_VERIFY_PASS")
print("grasshopper_commit="+g)
print("broccoli_commit="+b)
print("node="+subprocess.check_output(["node","--version"],text=True).strip())
print("sqlite_integrity=ok")
print("external_ipv4=false")
