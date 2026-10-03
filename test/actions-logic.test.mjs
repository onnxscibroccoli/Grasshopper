import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("agentic loop concurrency is not unique per run", async () => {
  const source = await readFile(".github/workflows/agentic-development-loop.yml", "utf8");
  assert.match(source, /group: agentic-development-\$\{\{ github\.ref \}\}\n/);
  assert.doesNotMatch(source, /group: agentic-development-\$\{\{ github\.ref \}\}-\$\{\{ github\.run_id \}\}/);
  assert.doesNotMatch(source, /cron: "\*\/10 \* \* \* \*"/);
  const recordAt = source.indexOf("name: Record agent-generated diff");
  const resetAt = source.indexOf("git reset --hard HEAD", source.indexOf("name: Test agent-generated changes"));
  assert.ok(recordAt > 0 && resetAt > recordAt, "agent diff must be recorded before the workspace reset");
});

test("overnight chain does not interpolate dispatch input into the shell", async () => {
  const source = await readFile(".github/workflows/overnight-chain.yml", "utf8");
  assert.match(source, /CHAIN_REASON: \$\{\{ inputs\.reason \|\| 'schedule' \}\}/);
  assert.doesNotMatch(source, /reason=\$\{\{ inputs\.reason/);
});

test("k3s issue trigger is owner-only", async () => {
  const source = await readFile(".github/workflows/k3s-agentic-trigger.yml", "utf8");
  assert.match(source, /github\.event\.issue\.user\.login == github\.repository_owner/);
  assert.match(source, /contents\/\.github\/workflows/);
});

test("production merge gate does not execute pull request code with write token", async () => {
  const source = await readFile(".github/workflows/production-merge-gate.yml", "utf8");
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /PR_NUMBER: \$\{\{ github\.event\.pull_request\.number \}\}/);
  assert.match(source, /Protected branch rules not configured/);
  assert.doesNotMatch(source, /gh pr merge "\$\{\{ github\.event\.pull_request\.number \}\}"/);
  const gate = source.slice(0, source.indexOf("enable-automerge:"));
  assert.doesNotMatch(gate, /contents: write/);
});
