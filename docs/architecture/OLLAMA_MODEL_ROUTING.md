# Ollama dual-model routing harness

**Status:** Workflow and tests proposed in a draft PR. Live Ollama inference on GitHub Actions is **NOT VERIFIED** until the workflow finishes successfully.

## Verified model identifiers

- General repository analysis, dependency mapping, architectural history and documentation: `llama3.2:3b`.
- Granular syntax, refactoring, patch review and implementation-oriented code analysis: `deepseek-coder:6.7b-instruct`.

The requested phrase "Llama 3.4" does not correspond to a verified official Ollama model tag in the current implementation. The supported Llama 3.2 3B model is the safe default rather than a fabricated tag.

## Task classification

The workflow first downloads `llama3.2:3b`. `model_router.py classify` submits **only a short user-supplied technical task description** to the locally running Ollama instance and demands strict JSON classification as `architecture` or `code`. High-confidence classification chooses the specialist model. Low confidence, malformed model responses and timeouts fall back to a deterministic, testable task classifier. Only two model tags are allowlisted.

Example input and outcome:

| Task | Expected selected model |
| --- | --- |
| "Map the repository history, dependencies, and Broccoli architecture" | `llama3.2:3b` |
| "Diagnose kernel Binder compilation failures and refactor the allocator" | `deepseek-coder:6.7b-instruct` |
| "Document semantic action schemas and other repositories" | `llama3.2:3b` |
| "Implement a typed selector and add unit tests" | `deepseek-coder:6.7b-instruct` |

The router records `classification`, `model`, `confidence`, `route_source` and a non-acceptance flag in a private JSON route receipt, never the user's task verbatim. It then invokes the existing mainline-only repository analyzer via an argv list, not a shell string. Ollama output **cannot execute shell commands or merge GitHub changes**.

## GitHub Actions

Workflow: `.github/workflows/ollama-mainline-knowledge.yml`.

It has two jobs:

1. **routing-contract:** Python syntax and unit tests, JSON schemas, mainline-only history rules, secret redaction and private bot receipt tests. Runs on PR without downloading models.
2. **analyze:** On manual dispatch or weekly schedule only: installs Ollama in a disposable GitHub-hosted ARM64 runner, selects one of two verified tags, pulls the chosen specialist when necessary, clones allowlisted repository `main` branches, analyzes their first-parent `main` history, generates deidentified architecture documentation, bot candidates and inference references. Historical raw patch bodies and SHA-based file retrieval are forbidden.

The audit automatically samples eligible source files and first-parent history reachable from `main` only. The output distinguishes model inferences from actual verified acceptance evidence. No review artifact is published by default. An authorized manual operator may opt into a one-day artifact after a privacy scan; **generated code and candidate bots are never automatically committed, executed, deployed, or merged**.

## Completion criteria

- Syntax and unit tests PASS in GitHub Actions.
- Both route classes selected correctly under mocked Ollama and deterministic fallback.
- With live Ollama, classification returns a valid model receipt.
- Code-route run loads `deepseek-coder:6.7b-instruct`; architecture-route run uses `llama3.2:3b`.
- The mainline analyzer completes for the intended repository allowlist with evidence links into `blob/main`.
- All outputs undergo strict privacy screening, human review and issue/PR approval before promotion as reproducible bots or source-of-truth documentation.

## Safety and operational limitations

- No GitHub CI runner may receive operator OCI credentials, sudo tickets, secret OAuth tokens, or private Android guest images.
- Docker/OCI hosted LLM services are not used; Ollama listens only on runner loopback.
- This workflow currently uses Ollama's official install script. Before promoting it to mandatory production CI, pin and verify a reviewed release to reduce supply-chain risk.
- GitHub Actions runtime quotas and runner memory constraints apply. DeepSeek Coder 6.7B has a materially larger model footprint and slower CPU inference than Llama 3.2 3B.
- A correct model route does not prove a correct engineering suggestion. Every generated change must pass deterministic source validation, target integration tests and operator-controlled deployment gates.
