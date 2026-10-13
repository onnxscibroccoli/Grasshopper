import importlib.util
import pathlib
import sys
import unittest
from unittest.mock import patch
import json

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts" / "agentic-ci"
sys.path.insert(0, str(SCRIPTS))
SRC = SCRIPTS / "workflow_run_diagnose.py"
spec = importlib.util.spec_from_file_location("workflow_run_diagnose", SRC)
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)

class WorkflowObserverTests(unittest.TestCase):
    def test_rejects_invalid_scope(self):
        with self.assertRaises(ValueError):
            observer.summarize("arbitrary-command ;", 1, "failure", "token")
        with self.assertRaises(ValueError):
            observer.summarize("project/repo", -1, "failure", "token")
        with self.assertRaises(ValueError):
            observer.summarize("project/repo", 7, "impossible", "token")

    def test_limits_analyzed_failures(self):
        jobs = [{"id": i + 1, "conclusion": "failure"} for i in range(25)]
        with patch.object(observer, "get_api", return_value=json.dumps({"jobs":jobs}).encode()):
            result = observer.job_listing("project/repo", 44, "token")
        self.assertEqual(len(result), 4)

    def test_refuses_to_publish_raw_log_or_job_metadata(self):
        fake_logs = b"Failed to build. secret=secret-value-contact person@example.invalid"
        with patch.object(observer, "get_api", return_value=fake_logs), \
             patch.object(observer, "diagnose", return_value={
                "category":"code", "remedy":"none",
                "summary":"secret=secret-value-contact", "candidate_fix":"secret-value-contact",
                "source":"ollama"}):
            result = observer.classify_job("project/repo",
                                           {"id": 7, "name":"private-id"}, "token")
        txt = json.dumps(result)
        self.assertNotIn("secret-value", txt)
        self.assertNotIn("private-id", txt)
        self.assertNotIn("person@example.invalid", txt)
        self.assertEqual(result["status"], "INFERRED_REVIEW_REQUIRED")
        self.assertEqual(result["remedy"], "none")

    def test_observer_cannot_turn_failed_run_green(self):
        jobs = [{"id": 2, "conclusion": "failure"}]
        with patch.object(observer, "job_listing", return_value=jobs), \
             patch.object(observer, "classify_job", return_value={
                "status":"INFERRED_REVIEW_REQUIRED","category":"network","remedy":"retry"}):
            result = observer.summarize("team/repo", 109, "failure", "token")
        self.assertTrue(result["original_workflow_still_failed"])
        self.assertFalse(result["source_patches_applied"])
        self.assertFalse(result["upstream_job_replayed"])
        self.assertFalse(result["new_permissions_granted"])
        self.assertFalse(result["source_read_from_raw_sha"])

if __name__ == "__main__":
    unittest.main()
