import importlib.util
import json
from pathlib import Path
from unittest.mock import patch
import unittest

BASE = Path(__file__).resolve().parents[1]
SRC = BASE / "scripts/cloud-android/redroid-acceptance.py"
spec = importlib.util.spec_from_file_location("redroid_acceptance", SRC)
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)

def fixture():
    return {"schema":"grasshopper.redroid.acceptance/v1",
            "receipts": {k:{"test_id":test_id,"status":"NOT_PROVEN",
                            "sha256":"","transport":"","target_version":"",
                            "source":"human-observer","synthetic":False}
                         for k,test_id in a.REQUIRED.items()}}

class RedroidAcceptanceTests(unittest.TestCase):
    def test_no_live_receipts_is_blocked(self):
        decision=a.validate_observations(fixture())
        self.assertEqual(decision["status"],"BLOCKED")
        self.assertEqual(len(decision["missing_or_untrusted"]),len(a.REQUIRED))
        self.assertFalse(decision["production_promoted"])
        self.assertFalse(decision["reboot_authorized"])

    def test_fake_synthetic_receipts_cannot_promote(self):
        obj=fixture()
        for row in obj["receipts"].values():
            row.update(status="PASS",sha256="a"*64,transport="adb-loopback",
                       target_version="android-16",source="oci-local",synthetic=True)
        d=a.validate_observations(obj)
        self.assertEqual(d["status"],"BLOCKED")
        self.assertTrue(any("synthetic" in x for x in d["missing_or_untrusted"]))

    def test_realistic_receipt_set_only_eligible_for_manual_review(self):
        obj=fixture()
        for row in obj["receipts"].values():
            row.update(status="PASS",sha256="a"*64,transport="adb-loopback",
                       target_version="android-16",source="oci-local",synthetic=False)
        d=a.validate_observations(obj)
        self.assertEqual(d["status"],"RELEASE_ELIGIBLE_FOR_REVIEW")
        self.assertFalse(d["production_promoted"])
        self.assertFalse(d["reboot_authorized"])

    def test_missing_criterion_never_implicitly_passes(self):
        obj=fixture()
        del obj["receipts"]["browser_input"]
        with self.assertRaises(ValueError):a.validate_observations(obj)

    def test_loopback_only_and_allowlisted_nonmutating_adb(self):
        for serial in ("192.168.1.20:5555","0.0.0.0:5555","oci.example:5555",
                       "127.0.0.1:5556;rm -rf /"):
            with self.assertRaises(ValueError):
                a.adb_read(serial,["shell","getprop","sys.boot_completed"])
        for cmd in (["shell","input","text","password"],["shell","rm","-rf","/"],
                    ["push","key","/data"],["shell","am","start","-n","com.example"]):
            with self.assertRaises(ValueError):
                a.adb_read("127.0.0.1:5556",cmd)

    def test_boot_pass_does_not_falsely_prove_browser_or_termux(self):
        values={"sys.boot_completed":"1","ro.build.version.sdk":"36",
                "ro.product.cpu.abi":"arm64-v8a"}
        def read(serial,args):
            if args[1]=="getprop":return 0,values[args[2]]
            if args[1]=="wm":return 0,"Physical size: 1080x2400"
            return 1,""
        with patch.object(a,"adb_read",side_effect=read):
            result=a.live_adb("127.0.0.1:5556")
        self.assertEqual(result["status"],"ADB_BOOT_CHECK_PASS")
        for key in ("browser_input_proven","companion_input_proven",
                    "agent_actions_proven","physical_termux_parity_proven"):
            self.assertFalse(result[key])

    def test_android15_is_not_equivalent_to_android16(self):
        with patch.object(a,"adb_read",side_effect=lambda s,cmd:
                          (0,"35" if cmd[-1]=="ro.build.version.sdk" else
                             "arm64-v8a" if cmd[-1]=="ro.product.cpu.abi" else "1")):
            result=a.live_adb("127.0.0.1:5556")
        self.assertEqual(result["status"],"BLOCKED")

if __name__=="__main__":
    unittest.main()
