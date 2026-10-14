import importlib.util
import pathlib
import unittest

HERE = pathlib.Path(__file__).resolve().parents[2] / "scripts" / "agentic-ci"

def load(name):
    s = importlib.util.spec_from_file_location(name, HERE / (name + ".py"))
    m = importlib.util.module_from_spec(s)
    s.loader.exec_module(m)
    return m

guard = load("event_guard")
continuity = load("continuity")

def event(name="Reference tests", cause="push", conclusion="failure",
          actor="developer", hop=0, action="completed"):
    return {"action": action,
            "client_payload": {"observer_hops": hop},
            "workflow_run": {"id": 1234, "name": name, "event": cause,
                             "conclusion": conclusion, "head_branch": "main",
                             "actor": {"login": actor}}}

class PreactivationSafetyTests(unittest.TestCase):
    def test_observatory_is_disabled_by_default(self):
        path = pathlib.Path(__file__).resolve().parents[2] / ".github/workflows/ollama-ci-observatory.yml"
        workflow = path.read_text(encoding="utf8")
        self.assertIn("vars.AGENTIC_SELFTEST_ACTIVATED == 'true'", workflow)
        self.assertIn("vars.OLLAMA_OBSERVER_CANARY_ENABLED == 'true'", workflow)
        self.assertIn("github.event.workflow_run.name == 'Ollama CI failure canary'", workflow)
        self.assertIn("needs.lineage.result == 'success'", workflow)

    def test_dispatch_does_not_activate_unreviewed_continuity(self):
        path = pathlib.Path(__file__).resolve().parents[2] / ".github/workflows/ollama-ci-continuity.yml"
        workflow = path.read_text(encoding="utf8")
        self.assertIn("vars.AGENTIC_SELFTEST_ACTIVATED == 'true'", workflow)
        self.assertIn("github.actor != 'github-actions[bot]'", workflow)


class RecursionContracts(unittest.TestCase):
    def test_allows_exactly_one_first_generation_failure(self):
        obj = guard.decide(event())
        self.assertTrue(obj["allowed"])
        self.assertEqual(obj["hop"], 1)
        self.assertFalse(obj["may_dispatch"])

    def test_observer_self_and_nested_events_fail_closed(self):
        for x in [event(name="Ollama CI Observatory"),
                  event(name="Ollama CI Observatory", cause="workflow_run"),
                  event(cause="workflow_run"),
                  event(cause="repository_dispatch"),
                  event(hop=1), event(hop=20),
                  event(actor="github-actions[bot]", cause="workflow_dispatch"),
                  event(conclusion="success"), event(action="requested")]:
            with self.subTest(x=x):
                self.assertFalse(guard.decide(x)["allowed"])

    def test_fail_closed_for_invalid_event_payload(self):
        self.assertFalse(guard.decide({})["allowed"])
        self.assertFalse(guard.decide({"workflow_run":{"name":"abc"}})["allowed"])
        self.assertFalse(guard.decide(event() | {"client_payload":{"observer_hops":"oops"}})["allowed"])


class ContinuityContracts(unittest.TestCase):
    def test_success_requires_real_evidence(self):
        valid = {"outcome":"PASS", "all_required_checks_passed":True,
                 "upstream_result":"success", "provenance_valid":True}
        result = continuity.transition(None, valid)
        self.assertEqual(result["status"], "VERIFIED")
        for broken in [
            {**valid, "all_required_checks_passed":False},
            {**valid, "upstream_result":"failure"},
            {**valid, "provenance_valid":False}
        ]:
            with self.assertRaises(ValueError):
                continuity.transition(None, broken)

    def test_repeated_failure_causes_conclusive_handoff(self):
        state = None
        for attempt in range(3):
            state = continuity.transition(
                state, {"outcome":"FAIL", "failure_class":"kernel_binder_unexported"})
        self.assertEqual(state["status"], "AGENT_HANDOFF")
        self.assertEqual(state["handoff_reason"], "repeated_identical_failure")
        with self.assertRaises(ValueError):
            continuity.transition(state, {"outcome":"TRANSIENT",
                                          "failure_class":"network_failure"})

    def test_authentication_handled_by_person_not_model(self):
        state = continuity.transition(
            None, {"outcome":"AUTH_REQUIRED", "failure_class":"session_expired"})
        self.assertEqual(state["status"], "HUMAN_HANDOFF")
        self.assertEqual(state["handoff_reason"], "interactive_oauth_needed")

    def test_distinct_errors_eventually_handoff(self):
        state = None
        for i in range(continuity.MAX_EPISODE_ROUNDS):
            state = continuity.transition(
                state, {"outcome":"FAIL", "failure_class":f"error_{i}"})
        self.assertEqual(state["status"], "RETRY_ELIGIBLE")
        state = continuity.transition(state, {"outcome":"FAIL", "failure_class":"next_error"})
        self.assertEqual(state["status"], "AGENT_HANDOFF")

    def test_nonapproved_evidence_field_rejected(self):
        with self.assertRaises(ValueError):
            continuity.transition(None, {"outcome":"PASS",
                                         "all_required_checks_passed":True,
                                         "upstream_result":"failure",
                                         "provenance_valid":True})

if __name__ == "__main__":
    unittest.main()
