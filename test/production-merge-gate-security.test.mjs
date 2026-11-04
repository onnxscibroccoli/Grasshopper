import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const workflow = readFileSync(
  new URL('../.github/workflows/production-merge-gate.yml', import.meta.url),
  'utf8',
);

// Keep these assertions independent of the repository dependency graph.
// They verify the permission and promotion boundary, not the validity of YAML.
test('production-contract PR verification has only read permissions', () => {
  assert.match(workflow, /^on:\s*\n\s+pull_request:/m);
  assert.match(workflow, /^permissions:\s*\n\s+contents:\s+read\s*$/m);
  assert.match(workflow, /^\s+actions:\s+read\s*$/m);
  assert.doesNotMatch(workflow, /^\s+(?:contents|pull-requests|issues|checks|actions|id-token|deployments):\s+write\b/m);
  assert.doesNotMatch(workflow, /^\s+pull_request_target\s*:/m);
});

test('untrusted pull-request checkout never persists a GitHub token', () => {
  const checkout = workflow.split('- name: Checkout proposed commit')[1]?.split('\n      - ')[0] ?? '';
  assert.match(checkout, /uses: actions\/checkout@/);
  assert.match(checkout, /^\s+persist-credentials: false\s*$/m);
});

test('verification cannot enable automatic promotion', () => {
  assert.doesNotMatch(workflow, /\bgh\s+pr\s+merge\b/);
  assert.doesNotMatch(workflow, /\benable_auto_merge\b/);
  assert.doesNotMatch(workflow, /\bpull-requests:\s+write\b/);
  assert.doesNotMatch(workflow, /\b--auto\b/);
});

test('existing verification and recovery checks are retained', () => {
  for (const expected of [
    'npm test',
    'scripts/oci-openclaw-backup.sh',
    'security-phase-contract',
    'Documentation freshness',
    'Agentic Reference Control Plane',
    'Agentic Development Loop',
    'Agentic MVP Reproducibility',
    'BIST',
    'Reference tests',
    'Timed out waiting for required contract workflows.',
  ]) {
    assert.ok(workflow.includes(expected), `Missing required check: ${expected}`);
  }
});
