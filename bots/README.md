# Broccoli / Grasshopper reproducible bot library

The **barn** is a shared, versioned library of *small, proven chores*. An agent's complex run is a field experiment. Once a loop succeeds under real acceptance tests, distill it into a **bot recipe** with inputs, preconditions, least-privilege capabilities, exact transport, postconditions, rollback and evidence. Like a reusable farm tool, it can be carried between devices without copying secrets or the operator's identity.

**Two separate ledgers:**
1. **Action telemetry:** private JSONL events (request ID, idempotency key, target class, tool, consent gate, redacted input classification, result, test identifier, timestamps). Keep per-user event data off public GitHub.
2. **Reusable recipe registry:** public, deidentified `bots/catalog.json` pointing to reviewed recipe specs and deterministic acceptance tests. A model's *proposal* is **NOT_PROVEN** until the workflow runs on a declared transport/version with an operator-approved promotion.

Lifecycle: `OBSERVED -> CANDIDATE -> TESTED -> REVIEWED -> PROVEN -> REVALIDATE`. The central catalog only accepts an accepted review and passing target-specific checks. A failed replay revokes confidence; it never silently reruns a sensitive user action.

Every recipe declares target types (local Android, cloud Android, Kali/Linux, DOM/browser or API/MCP), semantic selector strategy, capability/approval policy, replay prevention, stable action ID, verifier and rollback. Do not embed API keys, OAuth cookies, biometric artifacts, private user data, or environment-specific host IPs.

The Ollama audit workflow reads **only `main`** of allowlisted repositories and first-parent history reachable from `main`, and does not fetch code using commit SHA URLs. It makes *candidate* bot suggestions, not executable scripts. Review results before any public publication. Offline/local Ollama does not send prompt content to a hosted model.

See `schemas/reproducible-bot.schema.json` and `docs/architecture/OLLAMA_MAINLINE_KNOWLEDGE_PIPELINE.md` for review gates.
