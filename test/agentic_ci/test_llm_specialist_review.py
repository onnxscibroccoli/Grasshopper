"""Offline contracts for Llama architecture -> DeepSeek fine-grain routing."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
MODULE = ROOT / "scripts/agentic-ci/llm_specialist_review.py"
spec = importlib.util.spec_from_file_location("specialists", MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class SpecialistTests(unittest.TestCase):
    def create_repo(self, branch="main"):
        context = tempfile.TemporaryDirectory()
        self.addCleanup(context.cleanup)
        root = Path(context.name)
        subprocess.run(["git", "init", "-q", "-b", branch], cwd=root, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.invalid"], cwd=root, check=True)
        subprocess.run(["git", "config", "user.name", "CI Dummy"], cwd=root, check=True)
        (root / "src").mkdir()
        (root / "README.md").write_text("# Architecture overview\n")
        (root / "src/model.mjs").write_text("export const id = (value) => value;\n")
        (root / "src/executor.mjs").write_text("export function run(task) { return task; }\n")
        subprocess.run(["git", "add", "."], cwd=root, check=True)
        subprocess.run(["git", "commit", "-qm", "fixture main"], cwd=root, check=True)
        out = root / "private"
        out.mkdir(mode=0o700)
        return root, out

    def test_requires_canonical_main(self):
        repo, _ = self.create_repo("experiment")
        self.assertFalse(module.is_canonical_main(repo))
        with self.assertRaises(ValueError):
            module.analyze(repo, repo / "private")

    def test_rejects_unapproved_model(self):
        with self.assertRaises(ValueError):
            module.generate("model:unsafe", "task", "data")

    def test_redacts_sensitive_examples(self):
        text = "user@example.org password: super-secret-secret bearer " + ("A" * 110)
        out = module.scrub(text)
        self.assertNotIn("user@example.org", out)
        self.assertNotIn("super-secret-secret", out)
        self.assertNotIn("A" * 80, out)

    def test_provenance_and_order_from_main_only(self):
        root, out = self.create_repo()
        calls = []
        def models(model, instruction, prompt):
            calls.append((model, prompt))
            if model == module.GENERAL:
                self.assertIn("main:README.md", prompt)
                return {"components": ["execution engine"], "dependencies": ["semantic model"],
                        "risks": [], "evidence_refs": ["main:README.md"]}
            if model == module.CODE:
                self.assertIn("ARCHITECTURAL_CONTEXT", prompt)
                return {"symbols": ["run"], "code_risks": ["missing validation"],
                        "refactoring_candidates": ["add test"],
                        "evidence_refs": ["main:src/executor.mjs"]}
            raise AssertionError("unexpected model")
        with patch.object(module, "generate", side_effect=models):
            proof = module.analyze(root, out)
        self.assertEqual([c[0] for c in calls],
                         ["llama3.2:3b", "deepseek-coder:6.7b-instruct"])
        self.assertEqual(proof["status"], "PASS_TWO_MODELS_EVIDENCE_LINKED")
        self.assertTrue(proof["review_required"])
        self.assertFalse(proof["model_commands_executed"])
        report = json.loads((out / "private-specialist-review.json").read_text())
        self.assertEqual(report["source_branch"], "main")
        self.assertEqual(report["code_review"]["model"], module.CODE)
        self.assertTrue((out / "specialist-proof.json").is_file())

    def test_fabricated_source_reference_fails_closed(self):
        root, out = self.create_repo()
        with patch.object(module, "generate", return_value={
            "components": ["false"], "evidence_refs": ["main:private.txt"]}):
            with self.assertRaises(ValueError):
                module.analyze(root, out)
        self.assertFalse((out / "specialist-proof.json").exists())

    def test_requires_real_model_matching_response(self):
        class MockAPI:
            def __enter__(self): return self
            def __exit__(self, *args): return False
        with patch.object(module.urllib.request, "urlopen", return_value=MockAPI()), \
             patch.object(module.json, "load", return_value={
                 "model": "llama3.2:3b", "response": '{"symbols":[],"evidence_refs":[]}' }):
            with self.assertRaises(ValueError):
                module.generate("deepseek-coder:6.7b-instruct", "task", "data")

if __name__ == "__main__":
    unittest.main()
