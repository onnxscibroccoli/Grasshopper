import importlib.util
import json
import pathlib
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts" / "agentic-ci" / "ollama_selftest.py"
PUB = ROOT / "scripts" / "agentic-ci" / "public_report.py"
spec = importlib.util.spec_from_file_location("ollama_selftest", SRC)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
public_spec = importlib.util.spec_from_file_location("public_report", PUB)
public = importlib.util.module_from_spec(public_spec)
public_spec.loader.exec_module(public)


def config(folder, needs="{}", retries=2):
    return SimpleNamespace(
        argv_json='["python3","check.py"]',
        required_outputs_json="[]",
        needs_json=needs,
        workspace=str(folder),
        report=str(folder / "diagnostic.json"),
        max_retries=retries,
        command_timeout=20,
    )


class SelftestContracts(unittest.TestCase):
    def test_command_and_upstream_fail_closed(self):
        for argv in (["rm", "-rf", "/"], ["sh", "-c", "echo test"],
                     ["python3", "-c", "print('test')"],
                     ["npm", "install"], ["bash", "/root/unsafe.sh"]):
            with self.assertRaises(ValueError):
                mod.check_command(argv)
        self.assertEqual(mod.check_command(["npm", "test"]), ["npm", "test"])
        self.assertTrue(mod.upstream_failed({"compile": {"result": "failure"}}))
        self.assertTrue(mod.upstream_failed({"compile": {"result": "skipped"}}))
        self.assertFalse(mod.upstream_failed({"compile": {"result": "success"}}))
        with self.assertRaises(ValueError):
            mod.upstream_failed({"compile": "success"})

    def test_clean_pass_needs_no_ollama(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp)
            (path / "check.py").write_text("print('test succeeded')\n")
            with patch.object(mod, "diagnose", side_effect=AssertionError("no inference")):
                code = mod.run(config(path))
            self.assertEqual(code, 0)
            data = json.loads((path / "diagnostic.json").read_text())
            self.assertEqual(data["status"], "PASS")
            self.assertEqual(len(data["attempts"]), 1)
            self.assertFalse(data["source_mutated"])

    def test_transient_failure_can_recover_without_code_mutation(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp)
            (path / "check.py").write_text("print('ready')\n")
            with patch.object(mod, "execute",
                              side_effect=[(1, "EAI_AGAIN during download"), (0, "pass")]), \
                 patch.object(mod, "diagnose", return_value={
                     "category":"transient", "remedy":"retry", "source":"ollama",
                     "summary":"retry", "candidate_fix":"none"}), \
                 patch.object(mod.time, "sleep", return_value=None):
                code = mod.run(config(path))
            self.assertEqual(code, 0)
            report = json.loads((path / "diagnostic.json").read_text())
            self.assertEqual(report["status"], "PASS_AFTER_RETRY")
            self.assertTrue(report["human_review_required"])
            self.assertFalse(report["source_mutated"])
            self.assertEqual(len(report["attempts"]), 2)

    def test_failure_does_not_become_green(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp)
            (path / "check.py").write_text("raise SystemExit(3)\n")
            with patch.object(mod, "diagnose", return_value={
                     "category":"code", "remedy":"none", "source":"ollama",
                     "summary":"bug", "candidate_fix":"requires source PR"}):
                code = mod.run(config(path))
            self.assertEqual(code, 1)
            data = json.loads((path / "diagnostic.json").read_text())
            self.assertEqual(data["status"], "FAIL")

    def test_upstream_failure_blocks_all_commands(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = pathlib.Path(tmp)
            with patch.object(mod, "execute", side_effect=AssertionError("must not run")):
                code = mod.run(config(path, needs='{"unit":{"result":"failure"}}'))
            self.assertEqual(code, 2)
            data = json.loads((path / "diagnostic.json").read_text())
            self.assertEqual(data["status"], "BLOCKED_UPSTREAM")
            self.assertEqual(data["attempts"], [])

    def test_diagnosis_fallback_never_creates_shell_command(self):
        with patch.object(mod.urllib.request, "urlopen", side_effect=OSError("offline")):
            output = mod.diagnose("EAI_AGAIN", 0)
        self.assertEqual(output["remedy"], "retry")
        self.assertNotIn("command", output)
        self.assertEqual(mod.diagnose.__name__, "diagnose")

    def test_public_report_removes_free_text(self):
        report = {
            "status": "FAIL", "upstream_ok": True, "source_mutated": False,
            "human_review_required": True, "attempts": [{
                "attempt": 1, "exit_code": 7, "output_contract_ok": False,
                "diagnosis": {"category": "code", "remedy": "none", "source": "ollama",
                              "summary": "Sensitive details must never appear",
                              "candidate_fix": "Sensitive details must never appear"}}
            ]}
        safe = public.reduce_report(report)
        self.assertNotIn("Sensitive", json.dumps(safe))
        self.assertEqual(safe["status"], "FAIL")
        self.assertEqual(safe["attempts"][0]["diagnostic_class"], "code")
        self.assertFalse(safe["patch_applied"])

    def test_requires_every_output_artifact(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            self.assertFalse(mod.output_contract(root, ["artifacts/report.json"]))
            folder = root / "artifacts"
            folder.mkdir()
            (folder / "report.json").write_text("{}")
            self.assertTrue(mod.output_contract(root, ["artifacts/report.json"]))
            (folder / "report.json").write_text("")
            self.assertFalse(mod.output_contract(root, ["artifacts/report.json"]))


if __name__ == "__main__":
    unittest.main()
