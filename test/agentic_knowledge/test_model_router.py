import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch
import json
from types import SimpleNamespace

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts" / "agentic-knowledge" / "model_router.py"
spec = importlib.util.spec_from_file_location("model_router", SRC)
router = importlib.util.module_from_spec(spec)
spec.loader.exec_module(router)

class TaskRouterTests(unittest.TestCase):
    def test_architecture_task_routes_to_llama(self):
        decision = router.decide("Map the architecture and historical documentation for all repositories", no_model=True)
        self.assertEqual(decision["classification"], "architecture")
        self.assertEqual(decision["model"], "llama3.2:3b")

    def test_code_task_routes_to_deepseek(self):
        decision = router.decide("Refactor the binder driver, repair compiler errors, and implement unit tests", no_model=True)
        self.assertEqual(decision["classification"], "code")
        self.assertEqual(decision["model"], "deepseek-coder:6.7b-instruct")

    def test_model_judge_can_override_rules_when_confident(self):
        response = {"classification": "code", "confidence": 0.92, "reason": "syntax changes"}
        fake = {"response": json.dumps(response)}
        class MockResp:
            def __enter__(self): return self
            def __exit__(self, *exc): pass
        with patch.object(router.urllib.request, "urlopen", return_value=MockResp()), \
             patch.object(router.json, "load", return_value=fake):
            route = router.decide("Document the API contract after changing several core functions")
        self.assertEqual(route["classification"], "code")
        self.assertEqual(route["route_source"], "ollama")

    def test_uncertain_model_result_fails_to_deterministic_router(self):
        fake = {"response": json.dumps({"classification": "code", "confidence": 0.41})}
        class MockResp:
            def __enter__(self): return self
            def __exit__(self, *exc): pass
        with patch.object(router.urllib.request, "urlopen", return_value=MockResp()), \
             patch.object(router.json, "load", return_value=fake):
            route = router.decide("Summarize the architecture and repository history")
        self.assertEqual(route["classification"], "architecture")
        self.assertEqual(route["route_source"], "rules")

    def test_reject_secret_bearing_tasks(self):
        for task in ["Contact person@example.org to refactor our tests",
                     "Please document 212-555-0199 and the repository system",
                     "bad"]:
            with self.assertRaises(ValueError):
                router.safe_task(task)

    def test_no_shell_and_no_model_command_injection(self):
        route = {"classification": "code",
                 "model": "deepseek-coder:6.7b-instruct"}
        command = router.build_audit_command(
            route, SimpleNamespace(catalog="config/agentic-repository-catalog.json",
                                   output="generated/review"))
        self.assertIsInstance(command, list)
        self.assertEqual(command[-4:], ["--catalog", "config/agentic-repository-catalog.json",
                                        "--output", "generated/review"])
        with self.assertRaises(ValueError):
            router.build_audit_command({"classification":"code","model":"$(touch /tmp/attack)"},
                                       SimpleNamespace(catalog="safe", output="safe"))

    def test_route_file_not_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            target = pathlib.Path(d) / "route.json"
            args = SimpleNamespace(task="Map repository architecture across Broccoli projects",
                                   route_file=str(target), offline=True)
            self.assertEqual(router.classify_command(args), 0)
            with self.assertRaises(ValueError):
                router.classify_command(args)
            payload = json.loads(target.read_text())
            self.assertEqual(payload["model"], "llama3.2:3b")

if __name__ == "__main__":
    unittest.main()
