import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/desktop-access/guarded-boot-setup.py"
spec = importlib.util.spec_from_file_location("boot_guard", SCRIPT)
boot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(boot)


class GuardedBootTests(unittest.TestCase):
    def test_nonroot_agent_and_boot_restart(self):
        unit = boot.unit_text("/usr/bin/true")
        for required in ("User=grasshopper", "Restart=always", "NoNewPrivileges=true",
                         "After=network-online.target", "WantedBy=multi-user.target"):
            self.assertIn(required, unit)
        for forbidden in ("User=root", "@latest", "ExecStart=/usr/bin/npx",
                          "sudo -s", "systemctl reboot"):
            self.assertNotIn(forbidden, unit)

    def test_privilege_delegation_is_exact_and_opt_in(self):
        rule = boot.sudoers()
        self.assertIn("NOPASSWD:", rule)
        self.assertEqual(rule.count("/usr/bin/systemctl"), 3)
        for forbidden in ("NOPASSWD: ALL", "/bin/bash", "install", "*", "reboot"):
            self.assertNotIn(forbidden, rule)
        self.assertIn("NoNewPrivileges=false", boot.unit_text("/usr/bin/true", True))
        self.assertIn("NoNewPrivileges=true", boot.unit_text("/usr/bin/true", False))

    def test_readonly_stage_no_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            f = Path(folder) / "agent.js"
            f.write_text("fixture", encoding="utf-8")
            cmd = [sys.executable, str(SCRIPT), "stage",
                   "--entry", str(f), "--output-dir", folder]
            ok = subprocess.run(cmd, text=True, capture_output=True, timeout=8)
            self.assertEqual(ok.returncode, 0, ok.stderr)
            unit = (Path(folder) / boot.UNIT).read_text()
            self.assertIn("ExecStart=/usr/bin/env node ", unit)
            blocked = subprocess.run(cmd, capture_output=True, timeout=8)
            self.assertEqual(blocked.returncode, 2)

    def test_install_requires_host_pinned_entry(self):
        with tempfile.TemporaryDirectory() as folder:
            fake = Path(folder) / "agent.js"
            fake.write_text("fixture", encoding="utf-8")
            cmd = [sys.executable, str(SCRIPT), "install", "--entry", str(fake)]
            r = subprocess.run(cmd, capture_output=True, timeout=8)
            self.assertEqual(r.returncode, 2)

    def test_stage_denies_privileged_delegation(self):
        with tempfile.TemporaryDirectory() as folder:
            fake = Path(folder) / "agent.js"
            fake.write_text("fixture", encoding="utf-8")
            cmd = [sys.executable, str(SCRIPT), "stage", "--entry", str(fake),
                   "--output-dir", folder, "--allow-recovery-sudo"]
            r = subprocess.run(cmd, capture_output=True, timeout=8)
            self.assertEqual(r.returncode, 2)


if __name__ == "__main__":
    unittest.main()
