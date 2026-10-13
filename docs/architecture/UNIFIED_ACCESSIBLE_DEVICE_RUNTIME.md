# Broccoli + Grasshopper — Unified Accessible Device Runtime

**Status:** Canonical product goals and technology-neutral implementation contracts, draft for review.
**Source discipline:** For user-owned repositories, read from `main` only. Do not fetch content by raw commit SHAs or stale branches. All implementation details require test evidence before promotion to VERIFIED.

## North star

One continuous, accessible development/automation workspace across:
- **Physical Android**: smartphone interaction, local apps, voice/chat entry, accessibility semantics and biometric authentication handoff.
- **Cloud Android**: isolated persistent applications and session state, remote-screen presentation, software-testing profile and account-control tasks.
- **Cloud Linux desktop and Kali**: windowed apps streamed to the phone, browsers, IDEs, development toolchains, cloud administration and accessible fallback.
- **Cloud control plane**: orchestration, self-hosted MCP gateways, model-provider adapters, queuing, governor, data synchronization and event history.

No application should be forced into one execution target. A workflow can start on one device, continue through an authorized cloud worker and return for approval/verification without recreating user state or revealing secret credentials to an agent. Every component should be modular, free/open-source by default, self-hostable, and usable within expressly authorized free-tier capacity.

## Semantic UI schema

Each observed state exposes a device-neutral graph of `Device`, `Application`, `Window`, `Node`, `Action`, and `Event`. Every node has a stable semantic identifier, role, accessibility label, state, geometry/display transform, ownership package/process, timestamp, event origin, permission scope and confidence. It may include selected text only after privacy classification/redaction.

The schema covers Android documented accessibility APIs, browser DOM/ARIA, native Linux accessibility (AT-SPI where available), and sanctioned remote control transports. Never assume screenshot coordinates are stable identity. Unsupported capabilities degrade to authorized human control instead of bypassing permissions.

## Intents and execution schema

A normalized action request carries:
`request_id`, `idempotency_key`, `device_target`, `app_target`, `semantic_node_id`, `intent`, `parameters`, `capability_scope`, `approval_policy`, `expiry`, `provenance`, `expected_postcondition`.

Example *non-sensitive* intent: select the `search` node in an authorized browser app and enter a generic query. Agent models only propose typed intents; a local policy engine authorizes, resolves and executes them against the selected transport. Captured observations use separate event types from commands; **a change event must never replay its originating action**. Store an action ledger for deduplication, retries, fencing and recovery.

## Provider/transport architecture

`Voice/Text UI -> Intent Planner -> Policy Governor -> Event Bus -> Target Router -> Executor -> Semantic Observer -> Evidence/Audit`

Targets implement the same contract: `observe()`, `capabilities()`, `authorize()`, `execute()`, `waitFor()`, `checkpoint()`, `recover()`. Transport adapters cover Android Accessibility Service/Shizuku/rish where permitted, cloud Android ADB, browser automation with user OAuth handoffs, Linux AT-SPI, window streaming and API/MCP invocation.

The model SDK provides a common interface for model providers, local and free remote inference, and external MCP tools. It does **not** copy credentials. The secure gateway presents OAuth, CAPTCHA, PIN/biometric and payment prompts to the real user in a verified session, then grants a narrowly scoped, short-lived capability to the requesting worker. Do not automate CAPTCHA circumvention or biometric simulation.

## Runtime quality gates

- Device independence: each capability works locally and remotely using the same schema and contract tests.
- Governor: resource admission, CPU/RAM budget, availability fencing, cancellation, watchdogs, recovery and graceful degradation.
- Security: least privilege, Android documented permissions, encrypted token storage, explicit human approval, signed/expiring work orders, replay prevention, log redaction, private-only ADB/MCP transport.
- Accessibility: voice/touch alternatives, readable screen fit and zoom, input/IME round-trip, visual focus state, low-friction recovery and disability-friendly operation without a service paywall.
- Reliability: true end-to-end tests for live input, saved sessions, reboot recovery and reconnect. A process-running assertion is insufficient.
- Documentation: every verified architecture contract has a source owner, evidence link, lifecycle status, regression test, failure/postmortem and next gate. Maintain a searchable knowledge graph so future agents do not need the operator to restate the north star.

## Program priorities

1. Preserve current functional Grasshopper/Kali/RustDesk/web desktops.
2. Safely reclaim *verified obsolete* QEMU Android experiments; keep active functionality until proven replacement.
3. Establish Oracle UEK Binder compatibility and guarded Redroid ARM64 boot without public ADB.
4. Implement and test the semantic UI/action/control schema across Android and Linux/browser.
5. Integrate secure Android companion human approval and independent OAuth workflows.
6. Wire provider-neutral model/API/MCP devices to one orchestrator, then scale cautiously within verified free-tier entitlement.

**Governance:** Agent-visible source reads are from `main` only. Proposed code changes belong to feature branches and human-reviewed PRs; no direct protected-main mutations. No personal identifying data, secrets or authenticated disk contents in the repository.
