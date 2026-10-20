# Refined scope + tonight status (2026-10-19, ~22:00 EDT)

## Scope (Ian, t119u)
- **Phase 1 (IaC):** the existing OCI Grasshopper workstation plus the OCI Kali/OmniKali instance are the current IaC/clusters. No new K8s or Private Google Access. Research only; implementation is held until it can be tested in GitHub Actions.
- **Phase 2 (OAuth / MCP gateway / intent pruning):** inventory below. Reuse what exists before reimplementing.
- **Phase 3 (sandboxes):** the same two OCI workstations. They need a restore protocol: (1) re-run the documented bootstrap (`oci-bootstrap.sh`), (2) restore from the last known-good checkout/evidence, (3) **last resort: restart from the OCI Cloud terminal**. Research only, held as in Phase 1.
- **Phase 5 (HoloAgent-0 spatial):** DEFERRED. Not started.
- OEM matrix: OUT OF SCOPE. Persistence: manual Shevery start after each reboot. Hub 17692: loopback-only.

## Inventory (2026-10-19; 43 repos; workflows scanned on every branch, 3143 file/branch entries)
| Item | Repo@branch | Path | SHA / PR |
|---|---|---|---|
| Agentic Development Loop (Claude, Anthropic federation vars) | Grasshopper@main | .github/workflows/agentic-development-loop.yml | blob 4317ccb, main 3eef009 |
| Overnight chain (cron 00–08 EDT dispatches BIST + loop) | Grasshopper@main | .github/workflows/overnight-chain.yml | blob 77a16b3 |
| Agentic control plane / k3s trigger / reproducibility | Grasshopper@main | agentic-control-plane.yml, k3s-agentic-trigger.yml, agentic-reproducibility.yml | a51be67, 86f2787 |
| MCP grid contract workflow | Grasshopper (non-main branches only) | .github/workflows/mcp-grid-contract.yml | branch-only |
| OCI protected stage / UEK binder labs | Grasshopper | oci-grasshopper-protected-stage.yml, oci-uek-binder-*.yml | main + branches |
| Claude self-correct | helix@ci/claude-dispatch-parallel | .github/workflows/claude-self-correct.yml | blob 4891e2e |
| OCI sandbox IaC | helix@hugo/oci-sandbox-iac-20260929 | .github/workflows/oci-sandbox-iac.yml | blob 0299e0d |
| Agent dispatcher/gatekeeper/ingest | civicpatch@agent/alpha | .github/workflows/agent-*.yml | blob 4e8aac7 |
| xAI OAuth + Grok provider | broccoli-core@main | src/providers/xai_oauth.py, runtime/providers/grok.py, docs/XAI_OAUTH*.md | main f66678ea |
| OpenAI/xAI hybrid model runner | broccoli-core@main | hybrid/server/model_runner.py | f66678ea |
| Gateway OAuth notes | helix@main | production/gateway/oauth.md | main 8f687036 |
| oauth2-proxy (fork) | oauth2-proxy | upstream CI | fork |
| Guacamole | only in KG docs (omn-kali-knowledge-graph-master) | docs | no implementation |
| Intent pruning / "MCP gateway" | not found (default-branch code search) | — | MISSING |

## Tonight deliverable: present vs missing
- PRESENT: a scheduled autonomous loop (Claude) plus an overnight chain; Grok/OpenAI client code in broccoli-core (Python, not in Actions).
- ADDED (this PR, draft): a prompt-initialized Grok + ChatGPT orchestrator workflow with 10 mocked unit tests. See docs/PROMPT_ORCHESTRATOR.md.
- MISSING: activation (move ci-templates/prompt-orchestrator.yml into .github/workflows; the push token lacks workflow scope); repo secrets `XAI_API_KEY` / `OPENAI_API_KEY` (Ian adds them); a live run as dated evidence; overnight-chain dispatch of the orchestrator (held until a live run is green); intent pruning; MCP gateway.

No COMPLETE claims. Nothing merged.
