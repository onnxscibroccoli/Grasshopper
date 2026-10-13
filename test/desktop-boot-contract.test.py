import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
RDC = ROOT / "scripts/desktop-access/rdc-user-service.sh"
BOOT = ROOT / "scripts/desktop-access/boot-system-services.sh"


class DesktopBootContractTest(unittest.TestCase):
    def test_shell_scripts_parse(self):
        for path in (RDC, BOOT):
            p = subprocess.run(["bash", "-n", str(path)], capture_output=True, text=True)
            self.assertEqual(p.returncode, 0, p.stderr)

    def test_rdc_renders_nonroot_unit_without_secrets(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = dict(os.environ, HOME=tmp)
            proc = subprocess.run(["bash", str(RDC), "--render"], env=env,
                                  capture_output=True, text=True)
            self.assertEqual(proc.returncode, 0, proc.stderr)
            unit = proc.stdout
            for marker in ("[Unit]", "[Service]", "[Install]", "WantedBy=default.target",
                           "NoNewPrivileges=true", "Restart=always", "UMask=0077", " remote"):
                self.assertIn(marker, unit)
            for forbidden in ("sudo", "password=", "NOPASSWD", "--no-persist-session",
                              "ExecStartPre=rm", "0.0.0.0"):
                self.assertNotIn(forbidden, unit)
            destination = Path(tmp) / "grasshopper-rdc-test.service"
            destination.write_text(unit)
            probe = subprocess.run(["systemd-analyze", "verify", str(destination)],
                                   capture_output=True, text=True)
            self.assertEqual(probe.returncode, 0, probe.stderr)

    def test_rdc_requires_existing_installed_package_and_no_auto_cutover(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = dict(os.environ, HOME=tmp)
            proc = subprocess.run(["bash", str(RDC), "--install"], env=env,
                                  capture_output=True, text=True)
            self.assertEqual(proc.returncode, 2)
            self.assertIn("first stage a pinned local package", proc.stdout)
            self.assertFalse((Path(tmp) / ".config/systemd/user/grasshopper-rdc-remote.service").exists())

    def test_root_script_is_allowlisted_and_does_not_store_passwords(self):
        s = BOOT.read_text()
        self.assertIn("grasshopper-vnc.service", s)
        self.assertIn("grasshopper-novnc.service", s)
        self.assertIn("grasshopper-mcp.service", s)
        self.assertIn("loginctl enable-linger", s)
        self.assertIn("EUID != 0", s)
        for forbidden in ("NOPASSWD", "sudoers.d", "sudo -S", "systemctl restart",
                          "systemctl disable", "pkill", "rm -rf", "ExecStart=/bin/sh -c"):
            self.assertNotIn(forbidden, s)
        proc = subprocess.run(["bash", str(BOOT), "--invalid"], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 64)


if __name__ == "__main__":
    unittest.main()
