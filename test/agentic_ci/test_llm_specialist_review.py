"""Offline contracts for Llama architecture -> DeepSeek fine-grain routing."""
import importlib.util
import io
import time
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
                 "model": "deepseek-coder:6.7b-instruct", "response": '{"symbols":[],"evidence_refs":[]}' }):
            with self.assertRaises(ValueError):
                module.generate("llama3.2:3b", "task", "data")


class StreamingDeepSeekTests(unittest.TestCase):
    def frames(self, parts, delay=0.0):
        class Stream:
            def __enter__(self): return self
            def __exit__(self, *_): return False
            def __iter__(self):
                for frame in parts:
                    if delay:
                        time.sleep(delay)
                    yield json.dumps(frame).encode() + b"\n"
        return Stream()

    def chunk(self, part, done=False, model="deepseek-coder:6.7b-instruct"):
        return {"model":model,"response":part,"done":done}

    def test_deepseek_api_uses_streaming_and_llama_does_not(self):
        received=[]
        content='{"evidence_refs":["main:src/model.mjs"],"symbols":["execute"]}'
        chunks=[self.chunk(content[:20]),self.chunk(content[20:],done=True)]
        def fake(request, **kwargs):
            received.append(json.loads(request.data.decode()))
            return self.frames(chunks)
        with patch.object(module.urllib.request, "urlopen", side_effect=fake):
            result=module.generate(module.CODE,"Analyze functions","main evidence")
        self.assertEqual(result["symbols"],["execute"])
        self.assertEqual(received[0]["model"],module.CODE)
        self.assertTrue(received[0]["stream"])
        self.assertEqual(received[0]["format"],"json")
        self.assertFalse(received[0]["options"]["temperature"])

    def test_each_response_fragment_renews_inactivity_deadline(self):
        content='{"symbols":["function"],"evidence_refs":["main:src/model.mjs"]}'
        chunks=[self.chunk(content[:10]),self.chunk(content[10:30]),
                self.chunk(content[30:],done=True)]
        # Total elapsed > idle timeout; successive token gaps < idle timeout.
        with patch.object(module.urllib.request, "urlopen",
                          return_value=self.frames(chunks,delay=0.045)):
            result=module._deepseek_stream(object(),idle_seconds=0.11,total_seconds=1.5)
        self.assertEqual(result["symbols"],["function"])

    def test_slow_first_token_has_longer_cold_start_budget(self):
        content='{"symbols":["handler"],"evidence_refs":["main:src/executor.mjs"]}'
        chunks=[self.chunk(content[:20]),self.chunk(content[20:],done=True)]
        with patch.object(module.urllib.request,"urlopen",
                          return_value=self.frames(chunks,delay=0.08)):
            result=module._deepseek_stream(object(),idle_seconds=0.12,
                       startup_seconds=0.2,total_seconds=0.7)
        self.assertEqual(result["symbols"],["handler"])

    def test_first_token_timeout_expires_even_if_total_budget_remains(self):
        content='{"symbols":["handler"]}'
        with patch.object(module.urllib.request,"urlopen",
                          return_value=self.frames([self.chunk(content,done=True)],delay=0.15)):
            with self.assertRaises(TimeoutError):
                module._deepseek_stream(object(),idle_seconds=0.07,
                         startup_seconds=0.09,total_seconds=0.8)

    def test_stall_after_first_token_expires(self):
        class Pausing:
            def __enter__(self): return self
            def __exit__(self,*_): return False
            def __iter__(self):
                yield json.dumps({"model":module.CODE,"response":"{","done":False}).encode()
                time.sleep(0.25)
                yield json.dumps({"model":module.CODE,"response":"}","done":True}).encode()
        with patch.object(module.urllib.request, "urlopen",return_value=Pausing()):
            with self.assertRaises(TimeoutError):
                module._deepseek_stream(object(),idle_seconds=0.08,total_seconds=1.0)

    def test_empty_keepalive_does_not_renew_timer(self):
        class Metadata:
            def __enter__(self): return self
            def __exit__(self,*_): return False
            def __iter__(self):
                yield json.dumps({"model":module.CODE,"response":"{","done":False}).encode()
                for _ in range(5):
                    time.sleep(0.025)
                    yield json.dumps({"model":module.CODE,"response":"","done":False}).encode()
                yield json.dumps({"model":module.CODE,"response":"}","done":True}).encode()
        with patch.object(module.urllib.request,"urlopen",return_value=Metadata()):
            with self.assertRaises(TimeoutError):
                module._deepseek_stream(object(),idle_seconds=0.065,total_seconds=1)

    def test_missing_done_and_bad_model_fail_closed(self):
        cases=[
            [self.chunk('{"symbols":[]}')], # EOF without done
            [self.chunk('{"symbols":[]}',done=True,model=module.GENERAL)],
            [self.chunk("not-json",done=True)],
        ]
        for frames in cases:
            with self.subTest(frames=frames):
                with patch.object(module.urllib.request,"urlopen",
                                  return_value=self.frames(frames)):
                    with self.assertRaises(ValueError):
                        module._deepseek_stream(object(),idle_seconds=1,total_seconds=2)

    def test_absolute_deadline_even_when_tokens_keep_arriving(self):
        chunks=[self.chunk("{"),self.chunk('"'),self.chunk('a'),
                self.chunk('"'),self.chunk(":"),self.chunk("1"),self.chunk("}",done=True)]
        with patch.object(module.urllib.request,"urlopen",
                          return_value=self.frames(chunks,delay=0.04)):
            with self.assertRaises(TimeoutError):
                module._deepseek_stream(object(),idle_seconds=0.1,total_seconds=0.12)

if __name__ == "__main__":
    unittest.main()
