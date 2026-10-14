"""Verify 2x-5x job budget plans and workflow timeout wiring."""
import importlib.util
import json
import re
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/agentic-ci/timeout_budget.py"
SPEC = importlib.util.spec_from_file_location("timeout_budget", SCRIPT)
m = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(m)
POLICY = json.loads((ROOT / "config/agentic-ci-time-budgets.json").read_text())


class TimeoutPolicyTests(unittest.TestCase):
    def test_all_registered_jobs_in_range(self):
        self.assertEqual(len(POLICY["workflows"]), 8)
        for workflow, definitions in POLICY["workflows"].items():
            result = m.calculate(POLICY, workflow)
            self.assertEqual(set(result), set(definitions))
            for key, value in result.items():
                self.assertGreaterEqual(value, definitions[key]["expected_minutes"] * 2)
                self.assertLessEqual(value, 360)
                self.assertGreaterEqual(definitions[key]["multiplier"], 2)
                self.assertLessEqual(definitions[key]["multiplier"], 5)

    def test_historical_p75_adjustment(self):
        sample = {"Deterministic false-PASS and recursion regression tests": [3., 9., 10., 11.]}
        result = m.calculate(POLICY, "ollama-ci-activation-gate.yml", sample)
        self.assertEqual(result["offline-contract"], 30)

    def test_few_samples_use_reviewed_baseline(self):
        sample = {"Deterministic false-PASS and recursion regression tests": [190., 200.]}
        result = m.calculate(POLICY, "ollama-ci-activation-gate.yml", sample)
        self.assertEqual(result["offline-contract"], 12)

    def test_hard_360m_limit(self):
        sample = {"Llama mainline architecture and DeepSeek detailed code validation":
                  [290., 291., 296., 299.]}
        result = m.calculate(POLICY, "ollama-ci-activation-gate.yml", sample)
        self.assertEqual(result["two-model-specialists"], 360)

    def test_invalid_duration(self):
        self.assertIsNone(m.duration_minutes("bad", "bad"))
        self.assertIsNone(m.duration_minutes("2026-01-01T09:00:00Z",
                                              "2026-01-01T08:00:00Z"))
        self.assertAlmostEqual(m.duration_minutes("2026-01-01T09:00:00Z",
                                                  "2026-01-01T09:13:30Z"), 13.5)

    def test_invalid_factor_and_policy_blocked(self):
        mutated = json.loads(json.dumps(POLICY))
        mutated["workflows"]["ollama-ci-activation-gate.yml"]["offline-contract"]["multiplier"] = 6
        with self.assertRaises(ValueError):
            m.calculate(mutated, "ollama-ci-activation-gate.yml")
        mutated = json.loads(json.dumps(POLICY))
        mutated["platform_max_minutes"] = 999
        with self.assertRaises(ValueError):
            m.calculate(mutated, "ollama-ci-activation-gate.yml")
        with self.assertRaises(ValueError):
            m.calculate(POLICY, "unapproved.yml")

    def test_no_credentials_in_outputs(self):
        self.assertNotIn("github_pat_", json.dumps(
            m.calculate(POLICY, "ollama-ci-activation-gate.yml")))

    def test_every_job_has_dynamic_budget(self):
        folder = ROOT / ".github/workflows"
        for filename, definitions in POLICY["workflows"].items():
            with self.subTest(workflow=filename):
                txt = (folder / filename).read_text()
                self.assertIn("\njobs:\n", txt)
                body = txt.split("\njobs:\n", 1)[1]
                headers = [line[2:-1] for line in body.splitlines()
                           if line.startswith("  ") and not line.startswith("   ")
                           and line.endswith(":")]
                self.assertEqual(set(headers), set(definitions) | {"timeout-budget"})
                self.assertIn("    timeout-minutes: 12", body)
                for job in definitions:
                    start = body.find("\n  " + job + ":\n")
                    self.assertGreaterEqual(start, 0, f"job {job} not found")
                    piece_start = start + len("\n  " + job + ":\n")
                    # Find next top-level job header
                    next_job = re.search(r"\n  [a-z][a-z0-9-]*:\n", body[piece_start:])
                    if next_job:
                        piece = body[piece_start:piece_start + next_job.start()]
                    else:
                        piece = body[piece_start:]
                    expr = ("timeout-minutes: " + "$" +
                            "{{ fromJSON(needs['timeout-budget'].outputs.budgets)['" +
                            job + "'] }}")
                    self.assertIn(expr, piece)
                    self.assertIn("timeout-budget", piece)


if __name__ == "__main__":
    unittest.main()
