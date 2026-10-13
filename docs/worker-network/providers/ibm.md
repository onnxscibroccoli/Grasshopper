# IBM Cloud — Code Engine Jobs, Not Free Always-On VPC VMs

**Status: ACCOUNT/BILLING UNVERIFIED; discovery-only.** IBM's current new accounts are generally Pay-As-You-Go with identity-verification payment card. Code Engine includes a **free usage allowance**, but workloads can become chargeable above the allowance. Unlike Oracle A1, no dependable permanent Always Free IBM VPC VM is established by this guide.

Official prices: https://cloud.ibm.com/docs/codeengine?topic=codeengine-pricing ; account types: https://cloud.ibm.com/docs/account?topic=account-accounts ; regions: https://cloud.ibm.com/docs/codeengine?topic=codeengine-regions

## What to use IBM for

Disposable Node/Python/Go Linux container builds, architecture/API compatibility smoke tests, and stateless MCP handler test jobs. **Not** a persistent Android emulator, Kali desktop, or personal VM. Free Code Engine usage is consumed across apps, functions, jobs and builds, including CPU, memory and HTTP requests. Provider policy/quotas may change, so consult the current console for exact included units and limits before any execution.

## Step-by-step

1. Open https://cloud.ibm.com on a trusted phone browser; complete **IBM** login and any account identity/card verification directly with the provider only. Do **not** enter cards into a script. Check Account → Billing for PAYG, any legacy Lite plan, remaining credits and included allowance. **If unbounded PAYG cost exposure remains, no deployment is authorized.**
2. Install the official IBM Cloud CLI on a supported Linux/desktop or use its trusted cloud shell. Login by IBM single sign-on:
   ```bash
   ibmcloud login --sso
   ibmcloud account show
   ibmcloud resource groups
   ibmcloud target -r us-east
   ```
   The displayed one-time code is not suitable for a public GitHub Actions job. IBM CLI plugins are installed **only** from the official IBM catalog after checking download signature/platform.
3. Region candidates verified by IBM include `us-east` (Washington), `us-south` (Dallas), `eu-de` (Frankfurt), `eu-gb` (London), `jp-tok`, `au-syd`, `ca-tor`, `br-sao`, `eu-es`, `in-che`, `jp-osa`. The first choice `us-east` minimizes latency to the existing OCI Ashburn host; account-specific service limits still apply.
4. From IBM Code Engine console, inspect projects and usage **read-only**, check expected vCPU-seconds, GB-seconds, build and request usage against current included amounts. Capture the free/paid status for this account—not just public pricing. Avoid unbounded job retries/concurrency.
5. For a **future separately approved trial**: create one Code Engine project in `us-east`; run one tiny stateless container with finite runtime, CPU and memory; use scale-to-zero, a strict one-shot TTL and capture usage after execution. Don't rely on a budget alert as a charge blocker. Avoid costs for container registry, persistent storage, network, logs and egress.
6. Verify single-run exit code and output, delete temporary resources after test, and recheck billing. If a no-overage hard cap is not available, prefer GitHub Actions free public runners instead of IBM execution.

## Automation integration

Later adapter should implement `ibm_discover`, `ibm_account_status`, `ibm_ce_usage`, `ibm_job_plan`, but **not** `ibm_job_create` until provider account-specific enforced-zero-charge evidence exists. Per-provider scoped IAM/service credentials only; never copy another provider's OAuth token.

**Human handoff:** IBM SSO/device authorization and billing verification in IBM's own browser UI. No universal payment profile.
