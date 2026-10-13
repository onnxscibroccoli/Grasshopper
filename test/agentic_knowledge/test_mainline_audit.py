import importlib.util
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts" / "agentic-knowledge" / "mainline_ollama_audit.py"
spec = importlib.util.spec_from_file_location("mainline_audit", SRC)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class MainlineAuditTests(unittest.TestCase):
    def test_private_paths_never_enter_prompts(self):
        for name in ["docs/chatgpt-handoff-redroid-oci.md", "secrets/config.json",
                     ".env", "logs/session.log", "docs/personal-info.md",
                     "keys/client.pem", "node_modules/foo.js"]:
            self.assertFalse(audit.eligible(name), name)
        self.assertTrue(audit.eligible("docs/architecture/device-runtime.md"))

    def test_redaction_is_fail_closed_for_contact_and_credentials(self):
        sample = ("Contact person@example.org or 212-555-0199. "
                  "authorization: super-secrettoken-value "
                  "ocid1.instance.oc1.abcdefghijklmnopqrstuvwxyz987654321")
        redacted = audit.redact(sample)
        self.assertNotIn("person@example.org", redacted)
        self.assertNotIn("212-555-0199", redacted)
        self.assertNotIn("super-secrettoken", redacted)
        self.assertNotIn("ocid1.instance", redacted)
        self.assertTrue(audit.clean_enough(redacted))
        self.assertFalse(audit.clean_enough(sample))

    def test_history_is_anchored_to_main_without_checkout_sha(self):
        with tempfile.TemporaryDirectory() as d:
            p = pathlib.Path(d)
            def run(*args):
                return subprocess.run(["git", *args], cwd=p, text=True,
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                      check=True).stdout
            run("init", "-q", "-b", "main")
            run("config", "user.email", "test@example.invalid")
            run("config", "user.name", "CI Test")
            (p / "README.md").write_text("# Unified device automation\n")
            run("add", "README.md")
            run("commit", "-qm", "Add Android schema")
            run("checkout", "-qb", "experimental")
            (p / "untrusted.md").write_text("do not trust\n")
            run("add", ".")
            run("commit", "-qm", "Never include experimental branch")
            run("checkout", "-q", "main")
            h = audit.history_from_main(p)
            self.assertEqual(len(h), 1)
            self.assertIn("Android schema", h[0]["date_and_subject"])
            self.assertFalse(any("experimental" in repr(item) for item in h))

if __name__ == "__main__":
    unittest.main()
