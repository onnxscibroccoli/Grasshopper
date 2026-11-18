# Prompt Orchestrator (Grok + ChatGPT via GitHub Actions)

Workflow: staged at `ci-templates/prompt-orchestrator.yml`. The bot token lacks `workflow` scope, so Ian must `git mv` it to `.github/workflows/` (activation step). Script: `scripts/prompt-orchestrator.mjs`.
Tests: `test/prompt-orchestrator.test.mjs`. They mock HTTP and need no keys.

This is the prompt-initialized companion to `agentic-development-loop.yml`, which runs Claude Code
through Anthropic federation vars. The orchestrator writes **proposals only**: a markdown file goes on a new
`orchestrator/run-<id>` branch and a **draft** PR is opened. It never pushes to main, merges, or runs
model output.

## Secrets Ian must add (Settings → Secrets and variables → Actions)
| Name | Kind | Needed for |
|---|---|---|
| `XAI_API_KEY` | secret | provider `grok` / `both` |
| `OPENAI_API_KEY` | secret | provider `chatgpt` / `both` |
| `XAI_MODEL` | variable (optional) | overrides the default `grok-4` |
| `OPENAI_MODEL` | variable (optional) | overrides the default `gpt-4o` |

If a key is missing on a non-dry run, the run fails closed. Dry runs need no keys.

## Initialize by prompting
- CLI: `gh workflow run prompt-orchestrator.yml -f prompt="Propose the RishTransport authorize() test PR" -f provider=both -f dry_run=false`
- Issue comment (repo owner only, issues only, not PRs): `/orchestrate grok <prompt>`. Comment runs are live (dry_run=false).
- Start with `dry_run=true` (the default) to smoke-test the wiring.

## Safety
- Top-level `permissions: contents: read`. The job gets `contents: write` + `pull-requests: write` only to push its own branch and open a draft PR.
- Prompt and comment text pass through `env:`, never `${{ }}` inside `run:`, which blocks script injection. A test enforces this.
- API keys are redacted from proposal output.
- The system prompt restates the hard stops. Ian remains the merge authority.
