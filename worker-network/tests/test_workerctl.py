import importlib.util
import io
import json
import os
from contextlib import redirect_stdout
from pathlib import Path
import tempfile
import unittest
from unittest import mock

MODULE_FILE = Path(__file__).resolve().parents[1] / 'workerctl.py'
spec = importlib.util.spec_from_file_location('workerctl', MODULE_FILE)
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)

class OfflineNoSpendTests(unittest.TestCase):
    def setUp(self):
        self.cat = w.read_catalog()

    def test_all_eight_providers_present(self):
        self.assertEqual(len(w.available_providers(self.cat)), 8)

    def test_no_provider_can_autoprovision(self):
        for provider in self.cat['providers'].values():
            self.assertIs(provider['automatic_provisioning'], False)

    def test_plan_never_authorizes_mutations(self):
        plan = w.make_plan(w.resolve_selection('oci,gcp,aws', self.cat), self.cat)
        self.assertIs(plan['provides_cloud_resource_mutations'], False)
        self.assertTrue(all(x['deploy_authorized'] is False for x in plan['providers']))

    def test_invalid_selection_is_blocked(self):
        for value in ('', 'unknown', 'oci,misspelling'):
            with self.assertRaises(ValueError):
                w.resolve_selection(value, self.cat)

    def test_deduplicated_selection(self):
        self.assertEqual(w.resolve_selection('oci,gcp,oci', self.cat), ['oci', 'gcp'])

    def test_handoff_has_no_secrets_or_payment_fields(self):
        text = w.handoff('azure', self.cat)
        self.assertIn('az login --use-device-code', text)
        self.assertIn('NEEDS_USER_AUTH', text)
        self.assertNotIn('token=', text)

    def test_private_plan_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as path:
            output = Path(path) / 'nested' / 'plan.json'
            w.safe_write(output, '{"action":"PLAN_ONLY"}')
            if os.name != 'nt':  # Windows permission control is via filesystem ACLs
                self.assertEqual(output.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                w.safe_write(output, '{}')

    def test_auth_disallowed_ci_and_non_tty(self):
        with mock.patch.dict(os.environ, {'CI': 'true'}):
            self.assertEqual(w.start_auth('oci', self.cat), 3)

    def test_verify_missing_cli(self):
        with mock.patch.object(w.shutil, 'which', return_value=None):
            self.assertEqual(w.verify('oci', self.cat), 'CLI_MISSING')

    def test_verify_never_shows_tokens(self):
        with mock.patch.object(w.shutil, 'which', return_value='/usr/bin/oci'):
            with mock.patch.object(w.subprocess, 'run', return_value=mock.Mock(returncode=0)) as call:
                result = w.verify('oci', self.cat)
                self.assertEqual(result, 'AUTH_PROBE_PASS_FREE_ELIGIBILITY_UNVERIFIED')
                self.assertEqual(call.call_args.kwargs['stdout'], w.subprocess.DEVNULL)
                self.assertEqual(call.call_args.kwargs['stderr'], w.subprocess.DEVNULL)

    def test_onboarding_remains_blocked_and_private(self):
        with tempfile.TemporaryDirectory() as temp:
            filename = Path(temp) / 'job.json'
            data = w.create_onboarding(['gcp', 'oci'], self.cat, filename)
            self.assertFalse(data['deploy_authorized'])
            if os.name != 'nt':  # Nonsecret state; ACLs on Windows
                self.assertEqual(filename.stat().st_mode & 0o777, 0o600)
            restored = w.load_onboarding(filename, self.cat)
            self.assertIn('DEPLOYMENT_BLOCKED', w.report_onboarding(restored, self.cat))
            self.assertNotIn('token=', filename.read_text())

    def test_onboarding_refuses_spend_flag(self):
        with tempfile.TemporaryDirectory() as temp:
            filename = Path(temp) / 'job.json'
            data = w.create_onboarding(['oci'], self.cat, filename)
            data['deploy_authorized'] = True
            filename.write_text(json.dumps(data))
            filename.chmod(0o600)
            with self.assertRaises(ValueError):
                w.load_onboarding(filename, self.cat)

    def test_catalog_rejects_provisioning_flag(self):
        modified = json.loads(json.dumps(self.cat))
        modified['providers']['oci']['automatic_provisioning'] = True
        with mock.patch.object(w, 'CATALOG', new_callable=lambda: mock.Mock(read_text=lambda **kwargs: json.dumps(modified))):
            with self.assertRaises(ValueError):
                w.read_catalog()

if __name__ == '__main__': unittest.main()
