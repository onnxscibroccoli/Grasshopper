#!/usr/bin/env python3
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

def run(cmd, timeout=30):
    try:
        p = subprocess.run(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                           timeout=timeout, check=False)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired as e:
        return 124, e.stdout or "", e.stderr or ""

def badging(apk):
    tool = shutil.which("aapt2")
    if not tool:
        return {"available": False, "reason": "AAPT2_NOT_INSTALLED"}
    rc, out, err = run([tool, "dump", "badging", apk], 30)
    if rc != 0:
        return {"available": False, "reason": "AAPT2_FAILED", "stderr": err[-4000:]}
    package = {}
    activities = []
    permissions = []
    for line in out.splitlines():
        if line.startswith("package:"):
            for k, v in re.findall(r"(name|versionCode|versionName|compileSdkVersion|targetSdkVersion|minSdkVersion):'?([^' ]+)'?", line):
                package[k] = v
        elif line.startswith("uses-permission:"):
            m = re.search(r"name='([^']+)'", line)
            if m:
                permissions.append(m.group(1))
        elif line.startswith("launchable-activity:"):
            m = re.search(r"name='([^']+)'", line)
            if m:
                activities.append(m.group(1))
    return {"available": True, "package": package, "permissions": permissions, "launchableActivities": activities}

def zip_inventory(apk):
    with zipfile.ZipFile(apk) as z:
        names = z.namelist()
    layouts = sorted({n for n in names if re.match(r"res/layout(?:-[^/]+)?/[^/]+\.xml$", n)})
    dex = sorted(n for n in names if re.fullmatch(r"classes(?:\\d+)?\.dex", Path(n).name))
    native = sorted(n for n in names if n.startswith("lib/") and n.endswith(".so"))
    return {
        "layoutFiles": layouts,
        "layoutCount": len(layouts),
        "dexFiles": dex,
        "nativeLibraries": native,
        "hasManifest": "AndroidManifest.xml" in names,
        "hasResources": "resources.arsc" in names,
        "entryCount": len(names),
    }

def main():
    if len(sys.argv) != 2:
        print("usage: apk_inspector.py APK", file=sys.stderr)
        return 2
    apk = os.path.abspath(sys.argv[1])
    if not os.path.isfile(apk):
        print("APK_NOT_FOUND", file=sys.stderr)
        return 3
    try:
        result = {
            "schema": "omnikali.apk.static-inspection/v1",
            "apk": apk,
            "sizeBytes": os.path.getsize(apk),
            "badging": badging(apk),
            "zip": zip_inventory(apk),
        }
        print(json.dumps(result, separators=(",", ":")))
        return 0
    except zipfile.BadZipFile:
        print("APK_INVALID_ZIP", file=sys.stderr)
        return 4
    except Exception as exc:
        print(f"APK_INSPECTOR_ERROR:{exc}", file=sys.stderr)
        return 5

if __name__ == "__main__":
    raise SystemExit(main())
