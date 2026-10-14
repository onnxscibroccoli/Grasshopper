import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"scripts/cloud-android/render-redroid-quadlet.py"
spec=importlib.util.spec_from_file_location("render_redroid_quadlet",SRC)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class QuadletContracts(unittest.TestCase):
    def setUp(self):
        self.template=(ROOT/"deploy/quadlet/grasshopper-redroid.container.in").read_text()
        self.digest="e"*64

    def test_requires_pinned_digest_and_private_adb(self):
        file=mod.render_quadlet(self.template,self.digest)
        self.assertIn("redroid/redroid@sha256:"+self.digest,file)
        self.assertIn("PublishPort=127.0.0.1:5556:5555",file)
        self.assertIn("Restart=always",file)
        self.assertIn("ConditionPathExists=/dev/binder",file)
        self.assertNotIn("__REQUIRED_IMAGE_DIGEST__",file)

    def test_unpinned_latest_refused(self):
        for value in ["latest","sha256:latest","deadbeef","A"*64,"x"*64,"e"*65]:
            with self.assertRaises(ValueError):
                mod.render_quadlet(self.template,value)

    def test_missing_boot_or_device_gate_is_rejected(self):
        for essential in ("Restart=always","ConditionPathExists=/dev/binder",
                          "PublishPort=127.0.0.1:5556:5555","WantedBy=multi-user.target"):
            bad=self.template.replace(essential,"")
            with self.subTest(essential=essential):
                with self.assertRaises(ValueError):
                    mod.render_quadlet(bad,self.digest)

    def test_public_adb_rejected(self):
        altered=self.template.replace("PublishPort=127.0.0.1:5556:5555",
            "PublishPort=127.0.0.1:5556:5555\nPublishPort=0.0.0.0:5555:5555")
        with self.assertRaises(ValueError):
            mod.render_quadlet(altered,self.digest)

if __name__=="__main__":
    unittest.main()
