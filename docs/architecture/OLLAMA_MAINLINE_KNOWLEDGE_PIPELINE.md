# Ollama-driven mainline architecture intelligence and bot indexing

**Scope:** Deidentified, reproducible system design documentation for Broccoli Core, Grasshopper, Kali, Helix, Redroid, the Android companion and the related public repositories.

## Read policy and historical analysis

- Only clone **`refs/heads/main`** for an explicitly allowlisted repository. A repository without `main` is `SKIPPED`; other branches are not inspected or inferred to be authoritative.
- Review current canonical files and the **first-parent commit history reachable from `main`** with `git log refs/heads/main`. Record redacted subject, timestamp, changed-path counts and affected technical subsystems; no `git show <SHA>`, no checkout of historical SHA, and no reading raw commit URLs.
- Since earlier public history may contain personal data, **never ingest or publish historical patch text**. History provides change chronology and provenance, not authorization to republish old records.
- Prohibit fetching remote branches, submodules, untrusted CI code, private files or secret-bearing paths. The runner uses no personal/cloud credentials and no API keys.
- Model untrusted repository text as *data*, never commands. The Ollama model is local to the GitHub runner via loopback-only API; generated instructions are never executed.

## Agent loop and outputs

`enumerate main -> redact -> collect semantic evidence IDs -> classify historical milestones -> local Ollama per repository -> cross-repository synthesis -> validate evidence references -> redact outputs -> produce review-required docs and bot candidates`

Outputs are a narrative audit, graph of ownership and dependencies, risks/blockers, history timeline, evidence references that point to `blob/main` files and optional unproven bot recipe ideas. An inference has `FACT`, `INFERENCE` or `NOT_PROVEN` provenance. CI acceptance and live operator evidence always outrank LLM guesses.

**Publication boundary:** generated reports are retained only as short-lived GitHub Actions artifacts subject to privacy scanning, and are **not automatically committed or merged**. Treat public repository artifacts as public: review before allowing publication, and fail closed if generated content contains identifiers. The default audit output is review-only. No bot moves to `PROVEN` on model confidence alone.

## Collaborative software development with milestone check-ins

The supervisor delegates bounded work against a stable versioned recipe and stops at a **milestone gate** (tests, security, deploy, end-user interaction), instead of continually second-guessing every micro-action. At each milestone it reconciles observed evidence and intended postcondition, records what succeeded, and requests human approval only for a sensitive capability. This limits over-correction and supports independent agents, vendor adapters, platform APIs, and infrastructure-as-code.

The **barn metaphor**: a verified complex field job becomes a small, labeled implement. The shelf contains portable bots, not recordings of user passwords or opaque automation transcripts. A new worker can pick the right implement, verify its fit against the current app version and transport, and leave an audit receipt.

## Validation gates

- No unreviewed deployment, no sudo or root credentials in CI, no OCI mutation, no external hosted LLM inference and no auto-merging.
- All bot recipes fail closed until real acceptance evidence, rollback and a human-reviewed release.
- GitHub workflow action artifacts expire quickly and contain only scrubbed technical summaries; if the privacy validator flags content, do not publish any artifact.
- API/MCP/Android/browser observations never replay the command that triggered them. Every action has an idempotency key and capability boundary.

## Runtime assumptions

GitHub-hosted public ARM64 runners can execute Ollama on CPU. The default is `llama3.2:3b`; pulling a model consumes network bandwidth and runtime minutes. CI records the container and model identity, enforces a timeout and **never claims completeness when a model is unavailable**. The repo allowlist, prompts and source extractor are tested without requiring Ollama in unit tests.
