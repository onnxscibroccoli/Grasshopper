# Automation Design: Agentic Multi-Cloud Bootstrap (V0 → Production)

## V0 shipped in this repository

- `worker-network/catalog.json`: versioned, machine-readable offer and region catalog. Immutable `automatic_provisioning: false` for every provider.
- `worker-network/workerctl.py`: Python standard-library CLI. Android Termux/desktop (`catalog`, `wizard`, `plan`, `onboard`, `status`, `resume`, `handoff`, `verify`, `auth`), **no cloud create/update/delete commands**, suppresses verify command output. Auth requires interactive TTY and refuses CI.
- `workerctl onboard` stores a private 0600 **non-secret** resumable checklist and `workerctl resume` reports read-only auth probe results. It does not advance billing eligibility or deploy.
- `worker-network/tests/test_workerctl.py`: offline automated coverage of no-billing guarantees, secret output suppression, CLI selection and private report permissions.
- `.github/workflows/worker-network-plan.yml`: manually triggered read-only plan with selected provider(s), no privileged token scopes, no cloud credentials.
- `.github/workflows/worker-network-tests.yml`: tests runner compatibility on public repo standard jobs.

**What is NOT shipped:** generic cloud provisioning, subscription/account creation, cross-provider federation, cost-estimation engine, secure callback push service, persistent job database, out-of-band human approval service, or a self-hosted MCP gateway. These are important future milestones rather than unverifiable PASS claims.

## V1: authenticated private job control plane

1. **Operator UI** (Android-first): small accessible PWA + Termux CLI reads provider manifests; choose resources/capabilities. Store PWA session with passkeys, WebAuthn or properly scoped authentication—never the user's provider credentials. Prefer self-hosting on existing OCI A1 host under **private loopback** first.
2. **Broker**: durable SQLite job states; persist request_id, plan revision, expected resource price, worker route, approval role and expiration. Use monotonic job event IDs; a notification/observation of completion MUST NOT replay the command.
3. **Provider adapters**: discovery + `plan` only at first. Each connector returns `account_status`, `cost_mode`, `free_entitlement`, `limits`, `current_usage`, `cost_unknowns`, `next_manual_action`. Runtime providers integrate official SDK APIs, not screen scraping.
4. **Human-action handoff**: publish a protected status page with official vendor origin, step, state, code expiration, and continue/retry buttons. Never post OAuth `state`/code/verifier, auth response, or payment form data into GitHub artifacts. For device auth, present vendor's official user-code UX in a secure **private** view and poll the provider from the initiating trusted process only.
5. **Connection policy**: after each provider OAuth, independently validate scopes, subscription status and tenancy access. Separately check free-tier billing account and overage protection. A successful CLI sign-in cannot authorize spending.
6. **Approval and execution**: require explicit user approval of exact instance+region+storage+cost, then a second hard provider free-capability gate; use reserved resources and idempotency tags, post-action verification and compensating rollback. Under the currently strict ZERO BILLABLE mandate, any uncertain cost outcome remains permanently blocked.
7. **Worker plane**: narrow self-hosted MCP over protected loopback/Unix sockets; tools `worker_discover`, `resource_budget`, `job_plan`, `job_status`, `auth_handoff_status`, `request_manual_action`; **do not** expose public arbitrary command execution or passwords. Later use mTLS/PKCE on restricted remote gateway.

## Provider adapters / stages

| Provider | Discovery before mutation | OAuth handoff | Account-specific hard gate |
|---|---|---|---|
| OCI | Resource/limits/Usage API, boot+block, AD and instance list | OCI browser session or instance principals | Home region, Always Free aggregate, resource count, no paid shape |
| GCP | Projects, billingEnabled, quotas, instance/disk aggregate | Google browser CLI + ADC; workload federation | Active trial-specific non-billable state; no PAYG/billing upgrade |
| Azure | Subscription type, free-service eligibility expiry, quota, SKU | Device-code Entra browser | Credit-plan spending limit and exclusions checked; separate disk/network costs |
| AWS | Account Free vs Paid plan, signup date/credit expiry, EC2 type | IAM Identity Center device code | Protected Free plan; no credit overrun or unrestricted account |
| IBM | Account PAYG vs legacy Lite, Code Engine quota | IBM SSO browser | Absence of enforceable hard $0 cap blocks deployment |
| GitHub | Repository visibility, Actions policy/runner class | GitHub OAuth/App/OIDC | Public repo and standard runner only; no billable actions/storage |
| Cloudflare | Free vs Paid Workers plan, current daily quota | Wrangler browser login | Free-only plan, request/CPU/kv/storage accounting |
| Render | Free vs Paid service plan, payment/bandwidth | Dashboard GitHub OAuth | Free service/no payment method and caps |

## Architecture and threat model

- **Tenant confusion**: identity from Google != identity from AWS; enforce per-provider account binding, display alias and region, never let previous provider token be sent to another.
- **Prompt injection**: external docs/Issues/HTML cannot override free-only policy, request approval, or expand tool list. Treat LLM/Antigravity as *proposal generator*; an independent deterministic policy evaluator approves operations.
- **SSRF/RCE**: human provider URL must match allowlisted vendor origin; no arbitrary callback URL forwarding; MCP endpoints can only run allowlisted tools in a sandbox, with no `sudo`/root.
- **Leaked credentials**: encrypt per-device secrets under OS keychain; do not store in repo, JSON report, workflow output, public journal or phone screenshot. CI OIDC scoped to protected environments when later supported.
- **Cost DoS**: abort on missing billing guard, estimated marginal cost > $0, unverified data transfer, unknown backup/volume price, absent storage quota. Rate-limit and enforce TTL/cleanup for any future trial.
- **Events**: per-job lease, dedupe, idempotency keys; a UI focus/notification event is an observation, not a trigger to resend identical command.
- **Recovery**: preserve SSH/RDC/RustDesk and noVNC, snapshots only within confirmed free allowance, rollback on failure and run controlled reconnect acceptance tests. Existing OCI QEMU PID and chat state must not be modified by discovery.

## Staged acceptance tests

- V0: offline tests pass; no `oci compute instance launch`, `gcloud compute instances create`, `az vm create`, `aws ec2 run-instances`, payment-capture or third-party APIs in plan workflow.
- V1: SQLite migration and restart recovery; duplicate webhook produces one job; expired device code requires user re-auth; anonymous/unauthorized session cannot access handoff; secrets never rendered in logs.
- V2: mock provider adapter demonstrates exact cost-plan-to-approval-to-verify state transitions; action blocked for missing entitlement; static policy tests cannot be bypassed by LLM prompt.
- V3: **only with independently verified zero-charge guarantees and explicit user approval** may real-provider provisioning be considered. Operator reviews tier eligibility before run; spend monitor checks after run.

Official standards: https://modelcontextprotocol.io/specification ; https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers ; https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
