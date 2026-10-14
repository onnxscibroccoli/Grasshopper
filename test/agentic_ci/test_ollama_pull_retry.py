"""Model-pull retries are deterministic, exactly three, and fail closed."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts/agentic-ci/pull_ollama_model.sh'

MOCK_CURL = r'''#!/usr/bin/env bash
set -euo pipefail
out=''
previous=''
for arg in "$@"; do
  if [[ "$previous" == '--output' ]]; then out="$arg"; fi
  previous="$arg"
done
if [[ "$*" == *'/api/tags'* ]]; then
  if [[ "${SCENARIO:-}" == 'no_tags' ]]; then
    echo '{"models":[]}' > "$out"
  else
    echo '{"models":[{"name":"llama3.2:3b"}]}' > "$out"
  fi
  exit 0
fi
n=0
if [[ -f "$STATE_FILE" ]]; then n="$(cat "$STATE_FILE")"; fi
n=$((n+1))
printf '%s' "$n" > "$STATE_FILE"
case "${SCENARIO:-}" in
  always_fail) exit 22 ;;
  fail_twice) if ((n <= 2)); then exit 22; fi ;;
  fail_once) if ((n == 1)); then exit 22; fi ;;
  invalid_first) if ((n == 1)); then echo '{"status":"downloading"}' > "$out"; exit 0; fi ;;
  no_tags) ;;
esac
echo '{"status":"success"}' > "$out"
'''

class PullRetryTests(unittest.TestCase):
    def exercise(self, scenario='success'):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            fake_bin = folder / 'bin'
            fake_bin.mkdir()
            curl = fake_bin / 'curl'
            curl.write_text(MOCK_CURL)
            curl.chmod(0o755)
            sleeper = fake_bin / 'sleep'
            sleeper.write_text('#!/usr/bin/env bash\nprintf "%s\\n" "$1" >> "$SLEEP_LOG"\n')
            sleeper.chmod(0o755)
            state = folder / 'state'
            log = folder / 'sleep.log'
            env = dict(os.environ, PATH=str(fake_bin) + os.pathsep + os.environ['PATH'],
                       STATE_FILE=str(state), SLEEP_LOG=str(log), SCENARIO=scenario)
            result = subprocess.run(['bash', str(SCRIPT)], text=True, capture_output=True,
                                    timeout=12, env=env)
            calls = int(state.read_text()) if state.exists() else 0
            sleeps = log.read_text().splitlines() if log.exists() else []
            return result, calls, sleeps

    def test_bash_syntax(self):
        r = subprocess.run(['bash', '-n', str(SCRIPT)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_first_success_has_one_attempt_no_sleep(self):
        result, calls, sleeps = self.exercise()
        self.assertEqual((result.returncode, calls, sleeps), (0, 1, []), result.stderr)
        self.assertIn('OLLAMA_PULL=PASS', result.stdout)

    def test_one_failure_linear_delay(self):
        result, calls, sleeps = self.exercise('fail_once')
        self.assertEqual((result.returncode, calls, sleeps), (0, 2, ['10']), result.stderr)

    def test_two_failures_two_linear_delays(self):
        result, calls, sleeps = self.exercise('fail_twice')
        self.assertEqual((result.returncode, calls, sleeps), (0, 3, ['10', '20']), result.stderr)

    def test_exhaustion_is_failure_not_success(self):
        result, calls, sleeps = self.exercise('always_fail')
        self.assertEqual((result.returncode, calls, sleeps), (1, 3, ['10', '20']))
        self.assertIn('OLLAMA_PULL=FAIL_AFTER_3_ATTEMPTS', result.stderr)
        self.assertNotIn('OLLAMA_PULL=PASS', result.stdout)

    def test_http_success_without_success_status_is_retried(self):
        result, calls, sleeps = self.exercise('invalid_first')
        self.assertEqual((result.returncode, calls, sleeps), (0, 2, ['10']), result.stderr)

    def test_http_success_without_registered_model_fails_closed(self):
        result, calls, sleeps = self.exercise('no_tags')
        self.assertEqual((result.returncode, calls, sleeps), (1, 3, ['10', '20']))

    def test_unsupported_model_is_rejected_before_network(self):
        r = subprocess.run(['bash', str(SCRIPT), 'unreviewed:model'], capture_output=True, text=True)
        self.assertEqual(r.returncode, 2)
        self.assertIn('BLOCKED_UNAPPROVED_MODEL', r.stderr)

if __name__ == '__main__':
    unittest.main()
