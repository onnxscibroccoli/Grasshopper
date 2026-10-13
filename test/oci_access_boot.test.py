import configparser
import pathlib
import subprocess
import unittest

BASE = pathlib.Path(__file__).resolve().parents[1]
UNIT = BASE / "deploy/systemd/grasshopper-rdc.service"
INSTALLER = BASE / "scripts/oci-recovery/oci-access-boot.sh"

class BootRecoveryContracts(unittest.TestCase):
    def test_unit_is_non_root_restartable_and_network_ordered(self):
        cfg = configparser.ConfigParser(interpolation=None)
        cfg.read(UNIT)
        self.assertEqual(cfg.get("Service", "User"), "grasshopper")
        self.assertEqual(cfg.get("Service", "NoNewPrivileges"), "true")
        self.assertEqual(cfg.get("Service", "Restart"), "always")
        self.assertIn("network-online.target", cfg.get("Unit", "After"))
        self.assertEqual(cfg.get("Install", "WantedBy"), "multi-user.target")
        self.assertIn("desktop-commander@0.2.52 remote", cfg.get("Service", "ExecStart"))
        self.assertTrue(cfg.has_option("Unit", "ConditionPathExists"))

    def test_operator_initiated_install_is_non_disruptive(self):
        text = INSTALLER.read_text()
        self.assertIn("install-root)", text)
        self.assertIn("GRASSHOPPER_RDC_BOOT_APPROVED", text)
        self.assertIn("systemctl enable grasshopper-rdc.service", text)
        self.assertNotIn("systemctl restart ", text)
        self.assertNotIn("systemctl stop ", text)
        self.assertNotIn("systemctl reboot", text)
        self.assertNotIn("NOPASSWD", text)
        self.assertNotIn("sudoers", text)
        self.assertIn("INSTALLATION_MUTATIONS", text)
        self.assertIn("NOVNC_HTTP", text)
        self.assertIn("OUT_OF_BAND_RDC_DEVICE_PROOF", text)

    def test_script_is_valid_bash_and_unknown_command_rejected(self):
        syntax = subprocess.run(["bash", "-n", str(INSTALLER)],
                                capture_output=True, text=True)
        self.assertEqual(syntax.returncode, 0, syntax.stderr)
        bad = subprocess.run(["bash", str(INSTALLER), "unrecognized"],
                             capture_output=True, text=True)
        self.assertEqual(bad.returncode, 3)

if __name__ == "__main__":
    unittest.main()
