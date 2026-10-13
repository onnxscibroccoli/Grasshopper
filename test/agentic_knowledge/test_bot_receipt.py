import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SRC = ROOT / "scripts" / "agentic-knowledge" / "bot_receipt.py"
spec = importlib.util.spec_from_file_location("bot_receipt", SRC)
receipt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(receipt)

class ReceiptTests(unittest.TestCase):
    def test_minimal_receipt(self):
        r = receipt.validate(dict(bot_id="cloud-ui-snapshot", request_id="req-12345678",
            idempotency_key="nonce-1234567", device_target="cloud-android",
            milestone="ui-captured", state="MILESTONE"))
        self.assertEqual(r["schema"], "broccoli.bot.receipt/v1")
        self.assertIn("observed_at", r)

    def test_blocks_unexpected_private_payload(self):
        with self.assertRaises(ValueError):
            receipt.validate(dict(bot_id="cloud-ui-snapshot", request_id="req-12345678",
                idempotency_key="nonce-1234567", device_target="cloud-android",
                milestone="ui-captured", state="VERIFIED", password="do-not-write"))

    def test_never_allows_raw_target_or_username(self):
        with self.assertRaises(ValueError):
            receipt.validate(dict(bot_id="cloud-ui-snapshot", request_id="req-12345678",
                idempotency_key="nonce-1234567", device_target="10.0.0.5",
                milestone="ui-captured", state="VERIFIED"))

if __name__ == "__main__":
    unittest.main()
