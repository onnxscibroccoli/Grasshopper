# Google Cloud — Always Free x86 `e2-micro` and Cloud Shell

**Current deployment gate: BLOCKED.** Live Grasshopper gcloud read-only checks showed **billingEnabled=false on all four visible Google projects**, including `omnikali`. Google requires an **active Cloud Billing account** to use the Compute Engine free tier. Do not activate paid billing under the zero-billable policy. The $300 Free Trial can have a no-charge boundary for *eligible new accounts* while active, but its credits do not constitute perpetual zero-cost protection; verify account type in provider UI.

## Exact free allowance

- One **non-preemptible `e2-micro` instance-month** pooled across the eligible regions `us-east1` (South Carolina), `us-central1` (Iowa), `us-west1` (Oregon)—NOT one full-time VM in every region.
- **30 GB-months of standard persistent disk**, subject to other resource restrictions. Google Free Tier Compute Engine includes about 1 GB monthly eligible outbound traffic for certain destinations. No GPU, premium disks, externally billed marketplace images or extra boot-disk quantity as part of that offer.
- Trial and Free Tier are tied to a qualifying **billing account**. Instances outside these constraints can charge. No hardware-accelerated Android emulator on a tiny `e2-micro`; use it as a lightweight Linux x64 API/build/test worker if eligible.

Official: https://docs.cloud.google.com/free/docs/free-cloud-features

## Steps for Android-first onboarding

1. On Android Termux, preserve existing verified `gcloud` login and separate ADC; on Grasshopper both have passed. Check locally:
   ```bash
   gcloud version
   gcloud auth list
   gcloud projects list --format='table(projectId,name)'
   gcloud auth application-default print-access-token --quiet >/dev/null && echo ADC_AUTH_OK
   ```
   Never echo access tokens to logs. If missing, use `gcloud auth login` for the CLI and `gcloud auth application-default login` for Python/SDK; use local browser OAuth, not CI prompts.
2. Choose the correct project with `gcloud config set project PROJECT_ID` **only if wanted**; changing active project is not required for authentication. Validate its billing switch:
   ```bash
   gcloud billing projects describe PROJECT_ID --format='value(billingEnabled)'
   ```
3. If billing is **false**, mark `BILLING_REQUIRED/BLOCKED` and stop. Do **not** programmatically attach a payment instrument or run `gcloud beta billing projects link`.
4. If an account is an operator-verified **non-billable Free Trial**, check remaining trial days, credits and quotas on https://console.cloud.google.com/billing and obtain explicit human consent for any free trial resource. An **ordinary paid billing account** is not a hard $0 cap: do not deploy under this project's current policy.
5. Read-only regional discovery:
   ```bash
   gcloud compute machine-types describe e2-micro --zone us-east1-b --project PROJECT_ID
   gcloud compute instances list --project PROJECT_ID
   gcloud compute disks list --project PROJECT_ID
   ```
   Listing may fail if Compute Engine API is not enabled. **Do not enable APIs** automatically without checking cost and account permission; report `NEEDS_API_OR_PERMISSION`.
6. *Future gated creation walkthrough:* Console → Compute Engine → VM Instances → Create; location `us-east1` zone offered; `e2-micro`; eligible Linux OS image; standard persistent disk ≤30 GB-month pooled; no GPU/TPU; firewall closed except approved private control path. Review Google's estimated price **per line item**. Stop unless the provider UI confirms an account-level non-billable trial or independently sufficient free-only protection.
7. Verify actual usage and quotas *after* any separately approved deployment, including disk snapshots, public IPv4, and egress. Delete temporary test resources within the planned trial boundary; a stopped VM can leave billable disks/IPs.

## GitHub OIDC and no shared credentials

For *future* CI, create a dedicated Workload Identity Pool/Provider that only accepts GitHub OIDC subject/audience for a **protected environment**; grant a least-privilege role. Avoid service-account JSON keys in repositories. Workload Identity Federation setup itself requires a cloud-account administrator and must be reviewed against charges/permissions. The included plan workflow has **no cloud OIDC**, by design.

**Recommendation today:** use GitHub Actions public standard Linux x64/ARM64 runners instead of enabling Google billing. Never imply a free e2-micro is provisionable while the account billing switch is disabled.
