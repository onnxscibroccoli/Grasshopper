# One Interface, Multiple Provider Authorizations — Security Contract

## What is achievable

**Yes:** one Android-first onboarding UI to choose vendors, show account prerequisites and legitimate provider sign-in links, initiate official OAuth/device-code flows, validate read-only access, maintain an encrypted local inventory of connection status, and later dispatch signed task requests through independent provider adapters. GitHub Actions can initiate **plans** and receive **workload identity OIDC** in properly preconfigured trust relationships.

**No:** a universal OAuth access token that works at OCI, Google, Microsoft, AWS, IBM, Cloudflare and Render; a generic API for putting a user's card on all those platforms; permanently reusable user browser sessions; unattended CAPTCHA/MFA completion; or a guaranteed zero-cost machine obtained by automatically adding a card. Each organization has its own terms, legal consent, billing account and authorization policies.

## Identity diagram

```text
Android user / chosen existing IdP
   |  human signs in to each vendor ON ITS OWN DOMAIN (once per account where allowed)
   +-- Google Cloud: gcloud auth login + separate ADC or Workload Identity Federation
   +-- OCI: oci session authenticate; 60-min token, refresh window; instance principals where supported
   +-- Azure: az login --use-device-code; managed identity or federated Entra app
   +-- AWS: IAM Identity Center (device login) or GitHub OIDC -> scoped STS role
   +-- IBM: ibmcloud login --sso, IAM service credentials/temporary tokens if explicitly granted
   +-- GitHub: gh auth login --web or GitHub App; workflow OIDC from protected branch/environment
   +-- Cloudflare: wrangler login; separate scoped API token for service operations
   +-- Render: dashboard GitHub OAuth; optional explicitly scoped service API key
```

### Recommended low-risk bootstrap

1. On Android Termux, run `workerctl handoff` for the selected vendor and check the generic vendor domain.
2. Use provider-native browser/device login, not an imitation sign-in page. Auth links containing `state`, `code`, or callback tokens are **sensitive**, even if short-lived; never publish in GitHub output, PR comments, Issues or public chats.
3. Keep credentials in platform-vetted stores (CLI config with mode 0600 and protected home dir, or OS keychain/Vault); do **not** copy the Android phone's credential files into CI or another server. A rootless OCI worker might use instance principals in the future; user sessions need periodic reauth.
4. Call read-only provider APIs. Collect only `AUTH_VERIFIED`, cost-cap status, expiry status and provider account **alias**, never secret contents.
5. Separately authorize OIDC trust once per provider for your specific GitHub repository + protected environment. Agent workflow then receives short-lived credentials by **token exchange**, not a shared permanent refresh token.
6. Prompt for human consent again when adding new scopes, changing accounts, or upgrading paid service. A user may revoke consent at any time.

## Payment/Billing information

- Present official provider-console links only. No form fields collecting card number/CVV, no local vault of cards, no copy/paste of payment payloads, and no automated acceptance of provider ToS.
- **There is no universal cross-cloud "save my card once" setup** that all providers accept. A user's payment profile may be remembered by a specific provider or payment intermediary; linking it to a cloud subscription still requires that provider's own consent and eligibility checks.
- Our current owner rule is **zero billable until automated revenue exists and explicitly covers the cost**. Merely attaching a billing account is **not authorized**. Google projects currently have `billingEnabled=false`.
- Azure free-account credit spending limit is not a universal hard $0 cap and excludes certain third-party Marketplace charges. AWS Free plan is temporary. IBM PAYG can charge after free quota. Budget alerts do not ensure zero charge.

## Future approval/handoff state machine

`SELECTED -> ACCOUNT_CHECK -> NEEDS_HUMAN_ACCOUNT -> NEEDS_HUMAN_OAUTH -> AUTH_VERIFIED -> ENTITLEMENT_CHECK -> FREE_ONLY_POLICY_CHECK -> PLAN_REVIEW -> USER_APPROVES_EXACT_RESOURCE -> PLAN_APPLY -> POSTCHECK -> REGISTERED`.

Each transition stores: `request_id`, `provider`, `state`, `idempotency_key`, `requested_capabilities`, `timestamp`, `account_alias`, `expected_free_usage`, `expiry`, `evidence_hash` and `actor_approval`. Never store secrets, identity document images or payment details in the public event journal.

Handoff object should contain:

```json
{
  "request_id": "opaque-random-id",
  "provider": "azure",
  "state": "NEEDS_HUMAN_OAUTH",
  "instruction": "Open the official provider login on your phone",
  "official_origin": "https://login.microsoftonline.com/",
  "expires_at": "generated-by-the-provider",
  "code_in_public_log": false,
  "resume_method": "provider-device-code-polling-on-the-trusted-device"
}
```

Never invent provider-specific OAuth links, dynamically post codes to chat, or implement browser credential scraping. UI interaction cannot be impersonated as user consent. For network delivery of handoffs, use authenticated TLS, expiry, replay defenses and private push channels; human action remains on vendor page.

## CI workflow identity

Prefer GitHub-issued OIDC with `id-token: write` only on an **isolated approved deployment job**, only after upstream identity trust is configured and limited. The included `worker-network-plan.yml` deliberately has `contents: read` only. Do not grant `permissions: write-all`, store broad cloud admin keys in Actions, or run deployment jobs from pull requests/forks. Explicit GitHub environment protection required for future mutations.

Official references: https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers ; https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/clitoken.htm ; https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html ; https://learn.microsoft.com/cli/azure/authenticate-azure-cli-interactively
