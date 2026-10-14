# Broccoli CI Observatory — reproducible Ollama self-test contract

**State:** Draft / review required. No claim that all repositories have deployed this.

## Purpose

Turn failures into bounded, reproducible engineering evidence without falsely overriding failing GitHub Actions checks. The development agent follows **observe -> diagnose -> test bounded remedy -> verify -> report milestone**. Local Ollama is an advisory component, not an executor of arbitrary model suggestions.

This is an infrastructure-as-code capability shared by Grasshopper, Broccoli Core, OmniKali, Kali, Helix and the centralized bot library.

## Two complementary modes

1. **Reusable self-test**: `.github/workflows/ollama-selftest-reusable.yml` is invoked explicitly by a CI workflow at an acceptance milestone. The caller provides an exact JSON argv command, a JSON map of `needs` prerequisite statuses, and optionally required `artifacts/` output file contracts. The harness checks source from main only, runs the unchanged check, and diagnoses failures using a local **containerized Ollama `llama3.2:3b`** service. Only approved remedies may run: exact command retry or a controlled `npm ci --ignore-scripts` for a Node project with `package-lock.json`. A source-code fix is **never applied** based only on model text.
2. **Repository-wide observatory**: `.github/workflows/ollama-ci-observatory.yml` listens to completed workflows (globbed workflow names; self-exclusion) and, for unsuccessful outcomes, retrieves only the first four failed job log tails using a **read-only** GitHub Actions token. Logs are redacted locally before inference. It writes a short, structured public diagnostic summary containing only known-safe category/status codes. The original workflow result remains failed. It never downloads untrusted artifacts, checks out an upstream pull request, reruns a job, changes permissions or mutates source.

Both paths limit inference attempts, tool permissions, subprocess time, output size and artifact retention. Ollama uses the official `ollama/ollama` container over loopback inside a disposable GitHub-hosted job.

## Rules that prevent false successes

- A failed, cancelled or skipped prerequisite job is a **BLOCKED_UPSTREAM** condition. The self-test exits nonzero, even if its independently rerun command passes.
- A failed test cannot turn green because the LLM wrote a persuasive explanation or skipped a check.
- Self-healing is **bounded** to two diagnostic/retry attempts. If a transient failure disappears without any source mutation, report `PASS_AFTER_RETRY` and flag for human review. Structural failures remain `FAIL` and require a reviewed source patch.
- An expected output artifact must exist and be nonempty. Check results include actual exit status; RC=0 with no required evidence is not PASS.
- No model-created code is executed, no automatic CI overrides, no merge, no deployment, no sudo/root credential handling.
- Generated prose, original job logs, account details, emails, personal identifiers and model prompts are not uploaded to public artifacts. Published one-day artifacts contain only coded fields.
- Main-only canonical source discipline: no raw commit SHA source retrieval. Isolated PR tests may validate unmerged proposed files, which are never treated as canonical architecture.

## How a repository adopts the reusable gate

Once the central workflow is merged into Grasshopper main, a trusted repository may add a job like:

```yaml
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      # Existing test steps.

  agentic-acceptance:
    needs: [unit-tests]
    if: ${{ always() }}
    uses: onnxscibroccoli/Grasshopper/.github/workflows/ollama-selftest-reusable.yml@main
    permissions:
      contents: read
    with:
      check_argv_json: '["npm","test"]'
      required_outputs_json: '[]'
      upstream_needs_json: ${{ toJson(needs) }}
      max_retries: 2
```

This example will not turn a failed `unit-tests` job green. Every repository must choose its own deterministic check and nonempty evidence artifacts where applicable.

**Important GitHub behavior:** A cross-repository reusable workflow cannot be invoked at `@main` until the central workflow actually exists on central `main`. All multi-repository adoption PRs therefore remain drafts until central deployment and validation.

## Fleet coverage

For **existing and future workflows**, the observatory's `workflow_run` wildcard is intended to cover newly created workflow names in that repository without duplicating code or modifying each workflow. It does not replace a job-level quality gate; standalone observatory jobs diagnose, while explicit reusable caller jobs enforce acceptance. Validate wildcard/self-exclusion on GitHub Actions before promoting to a required check to avoid recursive or excess usage.

GitHub Actions do **not** provide a safe automatic mechanism that changes every repository's workflows merely because one central reusable workflow exists. A short, deidentified observatory bootstrap workflow must be proposed through a separate PR to each relevant repo. Adopt only after checking repository CI/privacy policy and the central dependency; do not assume other repos are modified.

## Review and ongoing supervision

Use milestone check-ins:
- **SOURCE_VALIDATED**: tests/inputs/provenance verified; no credentials copied.
- **TEST_FAILURE**: redacted result and stable check ID available.
- **DIAGNOSED**: local Ollama category and allowed remedy recorded.
- **RECHECKED**: unchanged command and output contract rerun.
- **READY_FOR_REVIEW**: structural issue linked to an independently tested patch proposal.
- **ACCEPTED**: human-reviewed PR and real device/CI acceptance proof, not model opinion.

Record successful cross-device automation only as bot candidates under `bots/`; a pattern becomes **PROVEN** once the same transport, device/app version, capability policy, replay control and acceptance tests pass.

## Before production rollout

- Run `python3 -m unittest discover -s test/agentic_ci -p 'test_*.py' -v`.
- Confirm the central contract workflow and the observer job pass on GitHub-hosted runners.
- Pin a verified digest for the official Ollama container and the external GitHub Actions references before requiring them in production.
- Validate `workflow_run` self-exclusion in a disposable/sandbox repository.
- Verify no organization quota, private repository runner charge, privileged token, secrets or cloud resources are unexpectedly consumed.
- Deploy repository-specific opt-in PRs only after central `main` is available.
- No OCI kernel/Redroid reboot or root mutation is a CI repair action.

**No model can guarantee every workflow succeeds.** The correct response to a hard failure is a bounded diagnosis, a tested corrective PR and an explicit failing gate until repaired.
