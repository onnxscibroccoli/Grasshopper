#!/usr/bin/env python3
"""Deterministic safe Android input round-trip for dedicated test APK only.

Install/launch is permitted ONLY with --approve-test-apk-install and a loopback
or named Android emulator serial. Never touches personal apps or credentials.
"""
import argparse
import hashlib
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

PKG="org.broccoli.remoteinputprobe"
ACTIVITY=PKG+"/.MainActivity"
BOUND=re.compile(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]")
SERIAL=re.compile(r"^(?:emulator-\d{4}|127\.0\.0\.1:[1-9][0-9]{1,4})$")


def run(serial: str, argv: list[str], seconds=30) -> str:
    if not SERIAL.fullmatch(serial):
        raise ValueError("ADB target must be explicit emulator or loopback")
    p=subprocess.run(["adb","-s",serial,*argv],check=False,
                     capture_output=True,text=True,timeout=seconds)
    if p.returncode:
        raise RuntimeError("ADB_TEST_OPERATION_FAILED")
    return p.stdout.strip()

def bounds(xml: str, resource: str) -> tuple[int,int]:
    root=ET.fromstring(xml)
    for n in root.iter("node"):
        if n.attrib.get("resource-id") == PKG+":id/"+resource:
            found=BOUND.fullmatch(n.attrib.get("bounds",""))
            if found:
                l,t,r,b=[int(v) for v in found.groups()]
                if 0<=l<r<=10000 and 0<=t<b<=10000:
                    return (l+r)//2,(t+b)//2
    raise ValueError("Test-only UI element not visible: "+resource)

def contains_result(xml: str, expected: str) -> bool:
    root=ET.fromstring(xml)
    return any(n.attrib.get("resource-id")==PKG+":id/probe_result"
               and n.attrib.get("text")==expected for n in root.iter("node"))

def dump(serial: str) -> str:
    # The test activity contains only synthetic text. No general-purpose UI
    # hierarchy from personal apps is captured or exported.
    run(serial,["shell","uiautomator","dump","/sdcard/broccoli-probe.xml"],35)
    xml=run(serial,["exec-out","cat","/sdcard/broccoli-probe.xml"])
    if len(xml)>300_000:
        raise ValueError("Unexpected UI hierarchy size")
    return xml

def smoke(serial: str, apk: Path) -> bool:
    if not apk.is_file() or apk.is_symlink() or apk.stat().st_size < 1000:
        raise ValueError("Unverified test-only APK")
    # Ensure the test app is the sole explicit target; never install to a
    # personal phone without operator invoking --approve-test-apk-install.
    run(serial,["install","-r",str(apk)],90)
    try:
        run(serial,["shell","am","start","-n",ACTIVITY],20)
        time.sleep(2)
        first=dump(serial)
        input_xy=bounds(first,"probe_input")
        bounds(first,"probe_submit")
        nonce="BROCCOLI"+hashlib.sha256(apk.read_bytes()).hexdigest()[:10].upper()
        run(serial,["shell","input","tap",*map(str,input_xy)])
        run(serial,["shell","input","text",nonce])
        time.sleep(.5)
        second=dump(serial)
        submit_xy=bounds(second,"probe_submit")
        run(serial,["shell","input","tap",*map(str,submit_xy)])
        time.sleep(.5)
        final=dump(serial)
        if not contains_result(final,"BROCCOLI_ACK:"+nonce):
            raise ValueError("IME_OR_BUTTON_ROUNDTRIP_NOT_VERIFIED")
        print("ANDROID_TEST_APK_INPUT_ROUNDTRIP=PASS")
        print("TEST_APK_SHA256="+hashlib.sha256(apk.read_bytes()).hexdigest())
        print("BROWSER_NATIVE_KEYBOARD=NOT_PROVEN_BY_ADB_TEST")
        print("DEDICATED_COMPANION_KEYBOARD=NOT_PROVEN_BY_ADB_TEST")
        return True
    finally:
        # Remove only our own fixture, not other packages.
        try: run(serial,["uninstall",PKG],30)
        except (RuntimeError,OSError,subprocess.TimeoutExpired): pass

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--serial",default="emulator-5554")
    p.add_argument("--apk")
    p.add_argument("--approve-test-apk-install",action="store_true")
    p.add_argument("--self-test",action="store_true")
    args=p.parse_args()
    try:
        if args.self_test:
            fixture='<hierarchy><node resource-id="'+PKG+':id/probe_submit" bounds="[10,20][100,120]"/><node resource-id="'+PKG+':id/probe_result" text="BROCCOLI_ACK:ABC"/></hierarchy>'
            assert bounds(fixture,"probe_submit")== (55,70)
            assert contains_result(fixture,"BROCCOLI_ACK:ABC")
            assert not contains_result(fixture,"BROCCOLI_ACK:BAD")
            print("UI_SELECTOR_CONTRACT=PASS")
            return 0
        if not args.approve_test_apk_install or not args.apk:
            raise ValueError("Explicit test APK install consent required")
        return 0 if smoke(args.serial,Path(args.apk)) else 2
    except (ValueError,RuntimeError,OSError,ET.ParseError,subprocess.TimeoutExpired,
            AssertionError) as e:
        print("ANDROID_INPUT_SMOKE=BLOCKED_"+type(e).__name__,file=sys.stderr)
        return 2

if __name__=="__main__":
    raise SystemExit(main())
