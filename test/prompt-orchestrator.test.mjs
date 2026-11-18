import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { run, resolveProviders, checkSecrets, callProvider, redact } from '../scripts/prompt-orchestrator.mjs';

const ok = (text) => async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }) });
const env = { XAI_API_KEY: 'xk', OPENAI_API_KEY: 'ok' };

test('resolveProviders', () => {
  assert.deepEqual(resolveProviders('both'), ['grok', 'chatgpt']);
  assert.deepEqual(resolveProviders('grok'), ['grok']);
  assert.throws(() => resolveProviders('claude'));
});
test('missing secret fails closed', () => {
  assert.throws(() => checkSecrets(['grok', 'chatgpt'], { XAI_API_KEY: 'x' }), /OPENAI_API_KEY/);
});
test('dry run makes no calls and needs no secrets', async () => {
  let called = false;
  const md = await run({ prompt: 'p', provider: 'both', dryRun: true, env: {}, fetchImpl: async () => { called = true; } });
  assert.equal(called, false);
  assert.match(md, /dry_run: true/);
});
test('live run without secrets fails closed', async () => {
  await assert.rejects(run({ prompt: 'p', provider: 'grok', dryRun: false, env: {}, fetchImpl: ok('x') }), /fail-closed/);
});
test('empty or oversized prompt fails closed', async () => {
  await assert.rejects(run({ prompt: ' ', provider: 'grok', dryRun: true }), /empty prompt/);
  await assert.rejects(run({ prompt: 'a'.repeat(8001), provider: 'grok', dryRun: true }), /too long/);
});
test('callProvider sends bearer to correct endpoint', async () => {
  const seen = [];
  const f = async (url, init) => { seen.push([url, init.headers.authorization, JSON.parse(init.body)]); return ok('hi')(); };
  assert.equal(await callProvider('grok', 'p', env, f), 'hi');
  assert.equal(await callProvider('chatgpt', 'p', env, f), 'hi');
  assert.equal(seen[0][0], 'https://api.x.ai/v1/chat/completions');
  assert.equal(seen[0][1], 'Bearer xk');
  assert.equal(seen[1][0], 'https://api.openai.com/v1/chat/completions');
  assert.equal(seen[1][2].messages[0].role, 'system');
});
test('HTTP error and empty body fail closed', async () => {
  await assert.rejects(callProvider('grok', 'p', env, async () => ({ ok: false, status: 401 })), /HTTP 401/);
  await assert.rejects(callProvider('grok', 'p', env, ok('')), /empty/);
});
test('keys are redacted from output and file is written', async () => {
  const out = `/tmp/orch-test-${process.pid}.md`;
  const md = await run({ prompt: 'p', provider: 'both', dryRun: false, env, fetchImpl: ok('leak xk ok'), out });
  assert.doesNotMatch(md, /leak xk/);
  assert.match(md, /\[REDACTED\]/);
  assert.ok(existsSync(out));
  assert.match(readFileSync(out, 'utf8'), /PROPOSAL ONLY/);
});
test('redact no-op without keys', () => assert.equal(redact('abc', {}), 'abc'));
test('workflow is fail-closed and least-privilege', () => {
  const wf = readFileSync(new URL('../ci-templates/prompt-orchestrator.yml', import.meta.url), 'utf8');
  assert.match(wf, /\$\{\{ secrets\.XAI_API_KEY \}\}/);
  assert.match(wf, /\$\{\{ secrets\.OPENAI_API_KEY \}\}/);
  assert.match(wf, /gh pr create --draft/);
  assert.doesNotMatch(wf, /gh pr merge/);
  assert.doesNotMatch(wf, /push origin main/);
  assert.match(wf, /github\.repository_owner/);
  for (const line of wf.split('\n')) {
    if (/\$\{\{ (inputs\.prompt|github\.event\.comment\.body) \}\}/.test(line)) assert.match(line, /^\s+(D_PROMPT|C_BODY):/);
  }
});
