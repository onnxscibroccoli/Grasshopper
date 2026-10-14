#!/usr/bin/env python3
"""Physical Android 15 Termux/Rish keyboard probe against the same APK as CI.

Never installs an APK or requests root. User must first install the signed
test fixture themselves and explicitly approve foreground app interaction.
"""
import argparse
import importlib.util
from pathlib import Path
import shlex
import subprocess
import sys
import time

PKG="org.broccoli.remoteinputprobe"
ACT=PKG+"/.MainActivity"
DUMP="/data/local/tmp/broccoli-ime-probe-ui.xml"

def command(argv: list[str], timeout: int = 24) -> str:
    allowed=[
        ["id","-u"],
        ["pm","path",PKG],
        ["am","start","-n",ACT],
        ["uiautomator","dump",DUMP],
        ["cat",DUMP],
        ["rm","-f",DUMP],
        ["am","force-stop",PKG],
    ]
    if argv not in allowed and not (
        len(argv)==4 and argv[:2]==["input","tap"] and all(v.isdecimal() for v in argv[2:])
    ) and not (len(argv)==3 and argv[:2]==["input","text"] and argv[2]=="BROCCOLLI2026RISH"):
        raise ValueError("No unreviewed Rish/Android shell command permitted")
    p=subprocess.run(["rish","-c",shlex.join(argv)],
                     capture_output=True,text=True,timeout=timeout)
    if p.returncode:
        raise RuntimeError("PHYSICAL_RISH_TEST_COMMAND_FAILED")
    return p.stdout.strip()

def main() -> int:
    p=argparse.ArgumentParser()
    p.add_argument("--approve-ui-test",action="store_true")
    args=p.parse_args()
    if not args.approve_ui_test:
        print("PHYSICAL_TERMUX_UI_PROBE=BLOCKED_REQUIRES_EXPLICIT_APPROVAL")
        return 2
    try:
        spec=importlib.util.spec_from_file_location(
            "safe_ui_probe",Path(__file__).resolve().parent/"smoke_ui.py")
        if not spec or not spec.loader:raise ValueError("test selector library unavailable")
        selectors=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(selectors)
        if command(["id","-u"]) != "2000":
            raise ValueError("Shizuku shell identity not proven")
        if not command(["pm","path",PKG]).startswith("package:"):
            raise ValueError("User must install the test-only APK manually")
        command(["am","start","-n",ACT])
        time.sleep(2)
        command(["uiautomator","dump",DUMP])
        first=command(["cat",DUMP])
        x,y=selectors.bounds(first,"probe_input")
        selectors.bounds(first,"probe_submit")
        command(["input","tap",str(x),str(y)])
        command(["input","text","BROCCOLLI2026RISH"])
        command(["uiautomator","dump",DUMP])
        middle=command(["cat",DUMP])
        x,y=selectors.bounds(middle,"probe_submit")
        command(["input","tap",str(x),str(y)])
        time.sleep(1)
        command(["uiautomator","dump",DUMP])
        final=command(["cat",DUMP])
        if not selectors.contains_result(final,"BROCCOLLI_ACK:BROCCOLLI2026RISH"):
            raise ValueError("Physical keyboard click/touch round-trip unverified")
        print("PHYSICAL_TERMUX_RISH_INPUT_PROBE=PASS")
        print("ANDROID_HOST_API35_PARITY=USER_APPROVED_LIVE_TEST")
        print("CLOUD_REDRIOD_AND_BROWSER_INPUT=NOT_PROVEN_BY_THIS_TEST")
        return 0
    except (OSError,ValueError,RuntimeError,subprocess.TimeoutExpired) as e:
        print("PHYSICAL_TERMUX_RISH_INPUT_PROBE=BLOCKED_"+type(e).__name__,file=sys.stderr)
        return 2
    finally:
        # Only clean our temporary capture and stop our own fixture; never
        # touch an account app, login, other display or developer session.
        for argv in (["rm","-f",DUMP],["am","force-stop",PKG]):
            try:command(argv)
            except (OSError,ValueError,RuntimeError,subprocess.TimeoutExpired):pass

if __name__=="__main__":
    raise SystemExit(main())
