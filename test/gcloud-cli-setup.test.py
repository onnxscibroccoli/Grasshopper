import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/cli/setup-gcloud-python.sh"

class SetupTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="gcloud cli ")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.sdk = self.root / "sdk with spaces"
        self.bin = self.root / "bin"
        self.runtime = self.root / "runtime"
        (self.sdk / "bin").mkdir(parents=True)
        self.bin.mkdir()
        self.env = dict(os.environ, GCLOUD_SDK_DIR=str(self.sdk), GCLOUD_BIN_DIR=str(self.bin), GCLOUD_RUNTIME_DIR=str(self.runtime), GCLOUD_PYTHON=sys.executable)
        self.launcher = self.sdk / "bin/gcloud"
        self.launcher.write_text('#!/usr/bin/env bash\nprintf "PYTHON=%s\\n" "$CLOUDSDK_PYTHON"\nprintf "ARG=%s\\n" "$@"\n')
        self.launcher.chmod(0o755)

    def run_setup(self):
        return subprocess.run(["bash", str(SCRIPT)], env=self.env, text=True, capture_output=True, timeout=15)

    def test_quoted_paths_arguments_and_existing_entrypoint_recovery(self):
        old = self.bin / "gcloud"
        old.write_text("original launcher")
        result = self.run_setup()
        self.assertEqual(result.returncode, 0, result.stderr)
        backups = list(self.runtime.glob("gcloud-entrypoint-backup-*"))
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_text(), "original launcher")
        result = subprocess.run([str(old), "argument with spaces", "literal $HOME"], capture_output=True, text=True, check=True)
        self.assertIn("PYTHON=" + sys.executable, result.stdout)
        self.assertIn("ARG=argument with spaces", result.stdout)
        self.assertIn("ARG=literal $HOME", result.stdout)

    def test_sdk_failure_preserves_existing_entrypoint(self):
        old = self.bin / "gcloud"
        old.write_text("original launcher")
        self.launcher.write_text("#!/usr/bin/env bash\nexit 9\n")
        self.assertEqual(self.run_setup().returncode, 9)
        self.assertEqual(old.read_text(), "original launcher")

    def test_interpreter_failure_preserves_existing_entrypoint(self):
        old = self.bin / "gcloud"
        old.write_text("original launcher")
        reject = self.root / "reject-python"
        reject.write_text("#!/usr/bin/env bash\nexit 8\n")
        reject.chmod(0o755)
        self.env["GCLOUD_PYTHON"] = str(reject)
        self.assertEqual(self.run_setup().returncode, 8)
        self.assertEqual(old.read_text(), "original launcher")

    def test_bad_download_digest_cannot_replace_entrypoint(self):
        old = self.bin / "gcloud"
        old.write_text("original launcher")
        mockbin = self.root / "mockbin"
        mockbin.mkdir()
        curl = mockbin / "curl"
        curl.write_text('#!/usr/bin/env bash\nwhile (($#)); do if [[ "$1" == -o ]]; then printf corrupt > "$2"; exit 0; fi; shift; done\nexit 1\n')
        curl.chmod(0o755)
        uname = mockbin / "uname"
        uname.write_text('#!/usr/bin/env bash\nif [[ "$1" == -m ]]; then echo aarch64; else echo Linux; fi\n')
        uname.chmod(0o755)
        self.env["GCLOUD_PYTHON"] = ""
        self.env["PATH"] = str(mockbin) + ":" + self.env["PATH"]
        self.assertNotEqual(self.run_setup().returncode, 0)
        self.assertEqual(old.read_text(), "original launcher")

if __name__ == "__main__":
    unittest.main()
