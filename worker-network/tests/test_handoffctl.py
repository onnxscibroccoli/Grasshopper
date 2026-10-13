"""Offline tests for local-only human handoff queue (no provider API calls)."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest import mock

module = Path(__file__).resolve().parents[1] / "handoffctl.py"
spec = importlib.util.spec_from_file_location("handoffctl", module)
handoff = importlib.util.module_from_spec(spec)
spec.loader.exec_module(handoff)

class HumanHandoffTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.file = Path(self.temp.name) / "private" / "handoffs.sqlite"
        self.con = handoff.open_database(self.file)
        self.addCleanup(self.con.close)

    def ticket(self):
        return handoff.create(self.con, "chatgpt", "data_export",
                              "https://chatgpt.com",
                              "Request your data export using Data Controls",
                              "unique-task-1234", 900)

    def test_private_db_and_pending_state(self):
        result = self.ticket()
        self.assertEqual(result["state"], "WAITING_USER")
        self.assertEqual(self.file.stat().st_mode & 0o777, 0o600)

    def test_idempotent_creation(self):
        self.assertEqual(self.ticket()["id"], self.ticket()["id"])
        self.assertEqual(self.con.execute("SELECT COUNT(*) FROM events").fetchone()[0], 1)

    def test_reused_idempotency_key_different_step_blocked(self):
        self.ticket()
        with self.assertRaises(ValueError):
            handoff.create(self.con, "chatgpt", "login",
                           "https://chatgpt.com", "Log in",
                           "unique-task-1234", 900)

    def test_untrusted_origins_or_callbacks_blocked(self):
        for origin in ("http://chatgpt.com", "https://evil.com",
                       "https://chatgpt.com/?code=secret",
                       "https://chatgpt.com@evil.com",
                       "https://chatgpt.com:8080"):
            with self.subTest(origin=origin):
                with self.assertRaises(ValueError):
                    handoff.validate_origin("chatgpt", origin)

    def test_token_bearing_instructions_blocked(self):
        for text in ("code=abc", "password=secret", "Authorization: Bearer x",
                     "sk-secret_data_12345678"):
            with self.assertRaises(ValueError):
                handoff.validate_instruction(text)

    def test_user_confirmation_is_not_auth_verification(self):
        result = self.ticket()
        with mock.patch.object(handoff.sys, "stdin", mock.Mock(isatty=lambda: True)):
            with mock.patch("builtins.input", return_value="CONFIRM"):
                with mock.patch("builtins.print"):
                    rc = handoff.main(["--db", str(self.file),
                                       "confirm", "--id", result["id"]])
        self.assertEqual(rc, 0)
        self.assertEqual(handoff.get(self.con, result["id"])["state"],
                         "AWAITING_VERIFICATION")

    def test_expired_session_stays_expired(self):
        result = self.ticket()
        with self.con:
            self.con.execute("UPDATE handoffs SET expires=? WHERE id=?",
                             ("2020-01-01T00:00:00+00:00", result["id"]))
        value = handoff.transition(self.con, result["id"],
                                   "AWAITING_VERIFICATION", {"WAITING_USER"})
        self.assertEqual(value["state"], "EXPIRED")

    def test_no_verification_bypass_or_deploy_method(self):
        self.assertFalse(hasattr(handoff, "deploy"))
        self.assertFalse(hasattr(handoff, "mark_verified"))

    def test_noninteractive_confirm_denied(self):
        result = self.ticket()
        with mock.patch.object(handoff.sys, "stdin", mock.Mock(isatty=lambda: False)):
            with mock.patch("builtins.print"):
                self.assertEqual(
                    handoff.main(["--db", str(self.file), "confirm", "--id", result["id"]]), 2)
        self.assertEqual(handoff.get(self.con, result["id"])["state"], "WAITING_USER")

if __name__ == "__main__":
    unittest.main()
