#!/usr/bin/env node
// Prompt-initialized orchestrator: sends a bounded prompt to Grok (xAI) and/or
// ChatGPT (OpenAI) and writes the replies as a proposal markdown file.
// Fail-closed: missing key for a requested provider => non-zero exit.
// It never pushes, merges, or runs model output. The workflow opens a draft PR.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const PROVIDERS = {
  grok: { env: 'XAI_API_KEY', url: 'https://api.x.ai/v1/chat/completions', modelEnv: 'XAI_MODEL', model: 'grok-4' },
  chatgpt: { env: 'OPENAI_API_KEY', url: 'https://api.openai.com/v1/chat/completions', modelEnv: 'OPENAI_MODEL', model: 'gpt-4o' },
};

export const SYSTEM_PROMPT = [
  'You are a bounded planning assistant for the Grasshopper repository.',
  'Propose ONE atomic, test-backed change as a plan plus unified diff.',
  'Hard stops: no prod mutate, no credential rotate, no AWS/RDS live, no live Helix/secrets cutover,',
  'no exposing port 17692 beyond loopback, no secrets in source, no Neon, no merging, no Phase 5.',
  'Your output is reviewed by a human; it is never executed automatically.',
].join(' ');

export function resolveProviders(sel) {
  if (sel === 'both') return ['grok', 'chatgpt'];
  if (sel in PROVIDERS) return [sel];
  throw new Error(`unknown provider: ${sel}`);
}

export function checkSecrets(names, env) {
  const missing = names.filter((n) => !env[PROVIDERS[n].env]).map((n) => PROVIDERS[n].env);
  if (missing.length) throw new Error(`fail-closed: missing secret(s): ${missing.join(', ')}`);
}

export async function callProvider(name, prompt, env, fetchImpl = fetch) {
  const p = PROVIDERS[name];
  const res = await fetchImpl(p.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env[p.env]}` },
    body: JSON.stringify({
      model: env[p.modelEnv] || p.model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`fail-closed: ${name} HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error(`fail-closed: ${name} empty response`);
  return text;
}

export function redact(text, env) {
  let out = text;
  for (const p of Object.values(PROVIDERS)) if (env[p.env]) out = out.split(env[p.env]).join('[REDACTED]');
  return out;
}

export async function run({ prompt, provider, dryRun, out, env = process.env, fetchImpl = fetch, now = new Date() }) {
  if (!prompt || !prompt.trim()) throw new Error('fail-closed: empty prompt');
  if (prompt.length > 8000) throw new Error('fail-closed: prompt too long');
  const names = resolveProviders(provider);
  let sections;
  if (dryRun) {
    sections = names.map((n) => `## ${n}\n\n(dry_run: no API call made)\n`);
  } else {
    checkSecrets(names, env);
    sections = [];
    for (const n of names) sections.push(`## ${n}\n\n${redact(await callProvider(n, prompt, env, fetchImpl), env)}\n`);
  }
  const md = `# Orchestrator proposal\n\n- generated: ${now.toISOString()}\n- providers: ${names.join(', ')}\n- dry_run: ${dryRun}\n- status: PROPOSAL ONLY (not verified, not merged)\n\n## prompt\n\n${prompt}\n\n${sections.join('\n')}`;
  if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, md); }
  return md;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const e = process.env;
  run({ prompt: e.ORCH_PROMPT, provider: e.ORCH_PROVIDER || 'both', dryRun: e.ORCH_DRY_RUN !== 'false', out: e.ORCH_OUT })
    .then((md) => console.log(md.slice(0, 2000)))
    .catch((err) => { console.error(err.message); process.exit(1); });
}
