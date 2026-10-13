# Human-Handoff Agent Control Plane — Design and Safety Contract

**Date:** 2026-10-13. **Priority:** the user wants a general-purpose, accessibility-first *agentic workflow platform* across websites, cloud providers, GitHub development workers and connected personal data, not merely a cloud CLI login script.

## Desired user experience

1. From the Android companion app, the owner asks: “Set up provider X,” “Finish the Android worker,” “Connect website Y,” or “Import my ChatGPT history privately.”
2. The control plane uses deterministic, scoped task plans and available provider adapters; approved autonomous steps proceed without interruptions. A provider-independent dispatcher chooses a development machine (OCI existing workstation for long-lived services, a GitHub job only for project-specific build/test, or another explicitly authorized environment).
3. An agent detects **HUMAN_ACTION_REQUIRED** (vendor OAuth, Google/Microsoft sign-in, saved-password autofill, passkey or MFA, CAPTCHA, user consent, payment-method review, or account export). It saves the exact non-secret task state, stops privileged automation and issues an expiring, authenticated notification to the Android app, containing the provider name, reason, official domain, required next action and a protected control-session link.
4. The Android companion verifies owner identity (passkey/biometric) and exchanges a single-use session grant for a scoped, short-lived control session. The user opens a secure desktop/webview (noVNC or RustDesk) that has already loaded the intended **official vendor page** on the selected worker. The desktop link itself is not a provider login; a gateway must separately authenticate/authorize the app user and protect websockify connections.
5. The owner signs in on the website, approves scopes, enters MFA/payment information **directly into the website**, or uses Google Password Manager/passkey on a trusted device when supported. The automation does not capture passwords, WebAuthn private keys, cards, CVVs, OAuth callback codes, or browser profiles.
6. An independent provider/site verifier checks the resulting **authorized** state through an official API, account status endpoint, or permissible UI interaction. Never equate “user tapped continue” with completed OAuth. The worker resumes from an idempotent checkpoint; observing the login-success event must not replay the login command.
7. For reproducibility, save code/config/test outputs and **non-sensitive** state to Git/GHCR/checkpoints. Store renewable site tokens only in a device-local encrypted vault with site/account scopes, if explicitly authorized and compatible with site policies. Destroy ephemeral browser session and clear cookies on job completion; revoke ephemeral access when TTL expires. Keep a journal with timestamps, job ID, action ID, retries, verification result and resource/budget facts.

## Important provider and platform realities

- **Sign in with Google** is a separate relying-party login/consent at each website. Signing into Google does **not** give an autonomous browser access to all websites where Google is used. Account-specific consent, MFA, passkey and site policies still apply. Google Password Manager can sync passwords/passkeys on user-signed-in eligible browsers, but **do not sign a disposable, shared GitHub Actions runner into the full Chrome profile**: that risks exposing all stored passwords, saved payment methods and sessions to temporary processes and logs. Prefer cross-device passkey confirmation from Android, vendor OAuth on the owner's phone, or a narrow service token.
- **GitHub-hosted Actions** may run isolated noVNC/MCP *integration tests*, software builds, model validation and Android test runners. GitHub's Aug-27-2026 Terms prohibit using hosted Actions for work unrelated to repository software production/testing/deployment and warn against treating Actions as a serverless service. Do not build a generally available personal account automation workstation or public user-facing interactive login service on hosted Actions; use OCI self-hosted workers or Codespaces/other properly licensed remote interactive development environments.
- **noVNC** is only a viewer, not identity protection. Never expose an unauthenticated websockify/VNC port or publish a capability token in a GitHub log, Issue, commit, artifact, or chat. Session links must be HTTPS with OIDC authentication at the gateway, same-site CSRF protection, per-user token exchange, minimal ttl, strict CSP/Origin/Host, and a revoke control. Previous Grasshopper raw-IP HTTP noVNC was not suitable for entering secrets; local nip.io TLS verification never proved phone reachability.
- **Billing policy:** existing user directive is strict **ZERO BILLABLE** until an independent automated revenue stream supports the billable resource and explicit separate authorization is given. An account may require a card just to gain access to advertised free-tier compute; card collection remains provider-owned, but authorization to attach a paid billing account is **not** implied. A human-facing BILLING_REVIEW step must show current paid-risk status. Unknown cost -> BLOCKED even if user completed signup.
- **ChatGPT conversations:** use OpenAI's supported **Settings → Data controls → Export data**, or its Privacy Portal. The export ZIP can contain chat history; delivery can take up to 7 days, download links expire after 24 hours and deleted chats cannot be recovered. Google login to ChatGPT does **not** give a general-purpose third-party API to read all account conversations. Prefer official export/import over scraping or restoring a browser's entire authenticated profile. The owner downloads the ZIP **directly to Android**; never upload it to a public GitHub repository or GitHub artifact.
- **Android private history store:** parse approved exports into a local SQLite FTS5 database (deduplicated by source/conversation/message hash), with optional local embeddings for semantic search. Keep it in an app-private directory (Termux `$HOME` or app internal storage), **not shared Downloads/`/sdcard`**. Android file-based device encryption helps, but plaintext remains visible to processes with filesystem access or unlocked device/backups; prefer encrypted database/files and optional Android Keystore-wrapped keys for private content from multiple services. Only append redacted counts/hashes to Git history; no conversation contents, OAuth cookies, or private account metadata in public docs.
- **Single login UX vs independent authorizations:** a Google/GitHub login may authenticate the *companion app*, but cannot substitute for every vendor's token and delegated scopes. Provider-specific token federation (e.g., GitHub Actions OIDC to OCI/GCP/Azure/AWS) is configured individually and does not grant automatic billing consent. Payment credentials cannot safely or universally be “entered once” for all independent cloud providers.

## Durable agent state machine

```text
REQUESTED → SCOPE_VALIDATED → PLANNED → EXECUTING
                  |                 |
                  |                 +→ NEEDS_HUMAN_ACTION
                  |                          |
                  |                   PRIVATE_NOTIFICATION
                  |                          |
                  |                   OWNER_AUTHENTICATED
                  |                          |
                  |                   USER_COMPLETED_ACTION
                  |                          |
                  |                   POST_ACTION_VERIFICATION
                  |                     /              \
                  |                  PASS              FAIL
                  |                   |                 |
                  |                   v          DIAGNOSE/RETRY
                  |                 EXECUTING           |
                  |                   |              BLOCKED/EXPIRED
                  |                   v
                  +--------------> COMPLETE
```

Persist each stage and checkpoint before sending a notification. Require a unique task ID and a separate action/transition idempotency key; a duplicate webhook or frontend reconnect is not a new command. A separate watchdog can safely resume interrupted agent work **only after re-evaluating current state**. Task-specific retry limits, account lockout prevention, provider backoff and human consent gate are mandatory.

## Realistic layers and deployment

**A. Persistent trust/control tier — OCI Grasshopper (existing VM):** owner authentication, workflow/agent policy, durable SQLite/Postgres job queue, encrypted site-scoped token vault, human-hand-off broker, private Android push/notification API, audit and MCP routing. Remains available independent of a GitHub Actions job lifetime. Initially all services bind 127.0.0.1 or a protected private Unix socket; no additional cloud VM/billing.

**B. Worker tier — project-specific build/test and authorized remote desktop:** 
- Existing Kali container and OCI QEMU for continuous Android work and long-lived browser-based user-mediated logins.
- GitHub Actions Ubuntu/ARM/Windows/macOS for legitimately scoped software development/testing, disposable build agents, temporary MCP protocol tests and reproducible image builds; **not** for hosting general-purpose third-party account automation or ongoing public inference.
- Future user-owned compute workers on additional providers only after verified zero-cost allowance and legal authorization.
- Browser automation via supported Playwright/WebDriver or app APIs; never bypass CAPTCHA, steal browser cookies, or assume password sync is a credential vault.

**C. Companion app — Android:** local login to control-plane account, biometric gate, notification inbox, "Review authorization" view, authenticated noVNC/RustDesk session launcher, approval/deny, task stream, local conversation import/FTS search, revoke/delete access.

**D. Agent tier:** provider-independent planner, incremental development agent, watcher/recovery, test agent, security/cost governor and knowledge-graph recorder. Permissions are scoped by prompt **and deterministic policy**. Read-only/test steps may proceed; cloud billing/permissions/account deletion/payment/large data transfer require explicit owner approval. An unrestricted, always-on “god mode” token is neither necessary nor safe. Agent prompts are untrusted compared with the policy engine.

## Implementable work packages

1. **Handoff Queue (v0):** local non-secret SQLite tickets with provider official origin allowlist, action type, TTL, idempotency, private file permissions and owner-confirmation placeholder. Human acknowledgement remains `AWAITING_VERIFICATION`; does *not* certify login. Tests: duplicates, expiry, unsafe URLs, tokens in instructions, invalid transitions.
2. **Secure Android UI:** private session authentication and notifications; no public tokens or webhook secret in UI link. OIDC user login should protect the entire control-plane service, not be confused with OAuth for the target website.
3. **Verified site adapters:** provider-specific checkers for allowed post-login signals; OAuth-backed official APIs when available; read-only initial capabilities. Do not invent “logged in” success by noticing a page.
4. **Remote desktop broker:** authenticated OIDC front door, expiring tunnel identity, noVNC/websockify behind TLS, reconnect/close behavior; preserve production RustDesk/HTTP noVNC recovery until HTTPS phone reachability proven.
5. **Conversation export/import:** request owner-action link to official ChatGPT export settings, download zip to Android through the provider's own flow, parse it locally with integrity checks and index FTS5.
6. **Agentic test pipeline:** connect Broccoli workflows, GitHub Actions CI, OCI Android worker, deterministic state machine and policy enforcement. Record PASS only for measured resource/transport revision; always preserve living workloads.
7. **Provider billing/adapters:** inspect independent account free-tier eligibility, resource usage and worst-case ancillary charges. No API creates/unrestricted billing changes under current zero-billable constraint.

## Acceptance / blockers

**Current status:** architecture designed. Actual public Android-app OIDC login, live noVNC link with secure authenticated handoff, backend notification delivery, third-party automatic website signups and encrypted conversation importer are **not yet implemented or verified**.

Proof of concept is allowed in **private local development only** with nonsecret tickets. Human interactions and trusted passwords remain on vendor websites; never publish public access links before TLS/identity protection are tested on the actual Android device.

Official references (verify as needed):
- GitHub hosted Actions limitations: https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
- OpenAI history export: https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data
- Google Password Manager cross-device: https://support.google.com/chrome/answer/6197437
- GitHub Actions workload identity: https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers
- Grasshopper zero-billable policy: ../operations/FREE_ONLY_CLOUD_POLICY_2026-10-12.md
