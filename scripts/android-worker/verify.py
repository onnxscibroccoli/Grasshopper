#!/usr/bin/env python3
"""Independent evidence checks. Run as worker operator; never infer UI from PID."""
import json, os, pathlib, subprocess, sys, time, uuid
ADB="/opt/android-sdk/platform-tools/adb"
OUT=pathlib.Path("/var/lib/grasshopper-android/evidence")
OUT.mkdir(parents=True,exist_ok=True)
def adb(serial,*args):
    return subprocess.check_output([ADB,"-P","5038","-s",serial,*args],timeout=45).decode().strip()
if os.environ.get("ROLE") not in ("companion","dev"): raise SystemExit("Set ROLE=companion or ROLE=dev")
report={"schema":"grasshopper.android-worker/v1","timestamp":time.time(),"devices":{}}
for role,serial,expected in [("companion","127.0.0.1:5555","2000"),("dev","127.0.0.1:5557","0")]:
    if role != os.environ.get("ROLE"): continue
    item={}
    try:
        subprocess.run([ADB,"-P","5038","connect",serial],check=True,timeout=15)
        deadline=time.monotonic()+480
        while time.monotonic()<deadline:
            try:
                if adb(serial,"shell","getprop","sys.boot_completed")=="1": break
            except (subprocess.SubprocessError,OSError): pass
            time.sleep(5)
        else: raise RuntimeError("boot-complete deadline exceeded")
        item["sdk"]=adb(serial,"shell","getprop","ro.build.version.sdk")
        assert item["sdk"]=="35",item
        item["root_request"]=adb(serial,"root")
        time.sleep(3)
        item["uid"]=adb(serial,"shell","id","-u")
        assert item["uid"]==expected,item
        item["build_fingerprint"]=adb(serial,"shell","getprop","ro.build.fingerprint")
        item["selinux"]=adb(serial,"shell","getenforce")
        adb(serial,"shell","input","keyevent","KEYCODE_HOME")
        adb(serial,"shell","uiautomator","dump","/sdcard/worker-ui.xml")
        subprocess.run([ADB,"-s",serial,"pull","/sdcard/worker-ui.xml",str(OUT/(role+".xml"))],check=True,timeout=45)
        assert "<node " in (OUT/(role+".xml")).read_text()
        with (OUT/(role+".png")).open("wb") as f:
            subprocess.run([ADB,"-s",serial,"exec-out","screencap","-p"],stdout=f,check=True,timeout=45)
        assert (OUT/(role+".png")).read_bytes().startswith(b"\x89PNG\r\n\x1a\n")
        marker=OUT/(role+"-expected-marker")
        if not marker.exists():
            marker.write_text(str(uuid.uuid4()))
            adb(serial,"shell","sh","-c","'echo "+marker.read_text()+" > /sdcard/grasshopper-persistence'")
        item["marker"]=adb(serial,"shell","cat","/sdcard/grasshopper-persistence")
        assert item["marker"]==marker.read_text()
        item["status"]="PASS"
    except Exception as exc:
        item["status"]="FAIL"
        item["error"]=str(exc)
    report["devices"][role]=item
report["status"]="PASS" if all(x["status"]=="PASS" for x in report["devices"].values()) else "FAIL"
(OUT/"acceptance.json").write_text(json.dumps(report,indent=2)+"\n")
print(json.dumps(report,indent=2))
sys.exit(0 if report["status"]=="PASS" else 1)

