# Multi-Cloud Worker Network — Complete Setup Handbook

**Edition:** 2026-10-13 · **Primary interface:** Android/Termux · **Alternative:** public-repository GitHub Actions · **Default policy:** **ZERO BILLABLE**.

> This handbook and its accompanying `workerctl.py` form a **tested read-only onboarding/plan prototype**. They do **not** automatically open cloud accounts, add credit cards, create virtual machines, or provision remote MCP gateways. Each provider has distinct identity, eligibility, billing, cost and API policies. No cloud resource should be deployed merely because its SKU is labelled "free" or because an account is authenticated.

## 0. Navigation

| Guide | Purpose | Status |
|---|---|---|
| [Oracle OCI](providers/oci.md) | existing Grasshopper/Kali/Android + future micro potential | Working environment; extra capacity blocked |
| [Google Cloud](providers/gcp.md) | x86 `e2-micro` test worker / Cloud Shell | Credentials working; four projects have billing disabled |
| [Microsoft Azure](providers/azure.md) | B1s, AMD64 and ARM64 temporary workers | Account eligibility unknown |
| [AWS](providers/aws.md) | 6-month/new-account credit worker | Account plan/age unknown |
| [IBM Cloud](providers/ibm.md) | bounded Code Engine job worker | Cost protection unknown |
| [GitHub Actions](providers/github.md) | x86/ARM/Linux/Windows/macOS public-repo test jobs | Immediately suitable in public repos |
| [Cloudflare Workers](providers/cloudflare.md) | small edge authentication/routing | Free-plan verification needed |
| [Render](providers/render.md) | sleeping web API test service | No payment method recommended |
| [Authentication and payment](AUTH_AND_BILLING.md) | one dashboard; scoped per-provider federation | Design contract |
| [Automation architecture](AUTOMATION_DESIGN.md) | state machine, handoffs, security, testing | Plan and v0 implementation |
| [Troubleshooting and recovery](TROUBLESHOOTING.md) | authentication, quota, missing access, cost | Procedures |

## 1. Target architecture

```text
Android Termux (preferred) ----- OR ----> Public GitHub Actions workflow_dispatch
       workerctl wizard/plan                    read-only workerctl plan
                 \                                  /
                  \    (no secrets in Actions)    /
                   --> Private operator control plane  <--
                              |
                    select cloud providers
                              |
                   free eligibility discovery
                              |
              NEEDS_HUMAN_AUTH / BILLING_REVIEW
                 | browser on user's phone
                 | MFA / OAuth / service-specific account
                 | NO payment-card collection in our software
                              |
                    per-provider scoped identity
                              |
               policy check, consent and approvals
                              |
                future *provider adapters*, fail closed
                              |
     OCI A1 host/Kali + Android | GitHub ephemeral OS workers
     Candidate GCP/Azure/AWS    | IBM/Cloudflare/Render jobs
```

**Crucial:** single dashboard and OIDC orchestration ≠ one universal Google login/billing credential for all platforms. A shared IdP may be federated *only after each cloud provider's admin config and consent*. Payment instruments are stored with providers or regulated payment processors **never with the worker network**. Provider auto-billing is disabled/blocked where possible. Vendor-native OAuth may expire; the operator may have to reauthorize.

## 2. Known baseline from live audits

- Oracle: one subscribed region `us-ashburn-1`, one `VM.Standard.A1.Flex` 2-OCPU/12-GiB running instance called Grasshopper, Kali in a container **on the same host**, existing QEMU Android guest. OCI boot 47 GB + data block 114 GB = **161/200 GB Always Free combined volume budget**; data volume **ATTACHED** and mounted as `/srv/grasshopper`. About 39 GB unallocated. OCI `available:39` A1 core figure is a **general service quota**, **not** free-tier eligibility. OCI historical Cost Analysis snapshot for Oct 1–11 returned USD 0.00; that is not a promise of future zero charges.
- Google: existing `gcloud` and application default credentials working on Grasshopper; **all four visible projects had `billingEnabled: false`** at last read. Do not enable billing or create Compute Engine VMs without a separate zero-charge account qualification gate.
- Both Grasshopper and Kali have RustDesk operator-verified connections. Keep SSH/RustDesk/noVNC recovery paths functional and preserve existing repositories/Android/QEMU processes.
- Available space on Grasshopper boot/root ~2 GB. Do not install Android SDK images on root; prefer existing mounted `/srv/grasshopper` after review.

## 3. Eligibility categories

| Class | Deploy automatically? | Definition |
|---|---|---|
| `VERIFIED_FREE_EXISTING` | No changes | Already running and independently checked against published/free account entitlement |
| `CANDIDATE_FREE` | **No** | Provider advertises a tier but current account usage/region/add-ons unverified |
| `CREDIT_TRIAL` | **No** | Costs may be hidden by expiring credits; requires explicit review and enforced spend limit |
| `BILLING_REQUIRED` | **No** | Subscription/billing activation required; absolute zero-billable policy blocks it |
| `BLOCKED_BILLABLE` | **Never** | Any proposed action with uncertain or >$0 worst-case exposure |

Provider limits, e.g. an OCI `standard-a1-core-count` of 41, Azure `az vm list-skus`, or Google's API quota, are **not** proof an instance will cost $0. Also watch boot disks, snapshots, public IPv4, bandwidth, idle instances, DNS, API calls and marketplace images.

## 4. Android/Termux quickstart (read-only)

Requirements: Python 3.10+ (already present in existing Termux), Git/HTTPS or locally copied checkout, user-controlled phone browser. No root or packages beyond Python for the planner.

```bash
cd ~/Grasshopper  # or a checked-out folder that contains worker-network/
python3 worker-network/workerctl.py catalog
python3 worker-network/workerctl.py wizard
python3 worker-network/workerctl.py plan --providers oci,gcp,azure,aws,ibm,github,cloudflare,render
python3 worker-network/workerctl.py onboard --providers oci,gcp,github --output "$HOME/worker-plans/onboarding-001.json"
python3 worker-network/workerctl.py status --file "$HOME/worker-plans/onboarding-001.json"
python3 worker-network/workerctl.py resume --file "$HOME/worker-plans/onboarding-001.json"
python3 worker-network/workerctl.py handoff --provider azure
python3 worker-network/workerctl.py verify --providers oci,gcp,github
```

`verify` executes only suppress-output, read-only commands; CLI authentication PASS does **not** prove cost eligibility. Reports can be saved in private (0600) files via `plan --format json --output "$HOME/worker-plans/plan-001.json"` (refuses overwrite). Do not commit those reports without reviewing identities and inventory fields.

**Interactive local login only (never through Actions or shell logs):**

```bash
python3 worker-network/workerctl.py auth --provider gcp
python3 worker-network/workerctl.py auth --provider azure
# OCI, AWS, IBM and GitHub also supported if the official CLI is installed.
```

The new `onboard` command creates a resumable **non-secret checklist** (mode 0600). `resume` performs ephemeral read-only login probes, but **does not change or advance eligibility/approval states**; no cloud worker may be created based on it. `status` works offline.

The login operation simply invokes the **official cloud CLI** and lets you complete its browser/device-code flow. It does not collect, store, forward or display secrets itself. The saved credentials belong to the cloud CLI on the local device. Use `verify` after, then **manually** review cost eligibility in the provider console.

## 5. GitHub Actions quickstart (no cloud provisioning)

Public repo only if $0 is mandatory; private repos have included minutes/overages and must be reviewed separately.

1. Put this code in the default branch of your own public repository.
2. Open **Actions → Multi-cloud worker plan → Run workflow**.
3. Enter `all` or a comma-separated subset such as `oci,gcp,github` and launch.
4. Read the job summary; its inputs and generic account-console URLs contain no OAuth callbacks or personal tokens.
5. Complete provider OAuth on your Android/desktop **outside** the job. Do not copy a provider's authorization code into Actions inputs or logs.
6. Use the separate **Worker catalog tests** workflow to validate the code on Linux x64/ARM64, Windows and macOS runners.

`workflow_dispatch` must be present on the default branch to run from the GitHub UI. This workflow uses **read-only permissions**, has no `id-token: write`, no cloud secrets, and no apply step. An account connection is not created merely by running the workflow.

## 6. Selection strategy for an Android automation organization

- **Continuous controller:** keep OCI A1 Grasshopper; never count Kali as a second OCI instance.
- **Physical-device integration:** Broccoli Core Termux + Rish/AccessibilityService bridge.
- **Android emulation:** current QEMU guest with strict memory/CPU budgeting; no second concurrent emulator until resource assessment.
- **Cross-platform builds:** public GitHub Actions runners, triggered only for actual test tasks; don't host production state on Actions runners.
- **Edge ingress:** optional Cloudflare Worker in a verified Free account, for low-CPU status/routing only; never expose a public command shell.
- **Sleeping web demo:** Render Free on an account without a payment method, for prototypes only.
- **Potential VM expansion:** review Azure trial/AWS Free plan; these are time-limited and **not persistent resources under a permanent $0 constraint**. GCP e2-micro is **currently blocked** by billing-disabled projects, and Oracle additional E2 micro is blocked by current volume allocation.

## 7. Acceptance checklist before a new free worker is *actually* deployed (future)

- [ ] Official provider documentation and live region/SKU checked on execution date.
- [ ] Account creation date, subscription kind, billing method and free/credit expiration validated by operator.
- [ ] Free usage baseline includes **all regions/projects/instances**, pooled caps and egress.
- [ ] All dependent resource prices checked: disks, IPv4, snapshots, images, data transfer, DNS, load balancer, logs.
- [ ] A provider-native **hard spend cap** exists or automatic provisioning remains blocked. Budget email alerts alone are not hard caps.
- [ ] The customer explicitly approves any account setup and billing terms using only the provider's official UI.
- [ ] OIDC workload identity trust pins repository/environment/branch/audience, with minimal read-only permissions to begin with.
- [ ] Deployment is dry-run/plan reviewed; rollback and TTL process tested, including dependent resource removal.
- [ ] Job emits no passwords/payment cards/refresh tokens/signed OAuth URLs in public logs.
- [ ] Post-deployment provider billing shows expected zero and job registry distinguishes `VERIFIED_FREE` from `PROVISIONED`.

**For now, the toolkit intentionally has no provisioning implementation.** This is safer than an allegedly "automated free-tier" script that creates billable VMs or invites the user to paste credentials into a public workflow.

## 8. Official references

- Oracle OCI Always Free: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Google Free Tier/trial: https://docs.cloud.google.com/free/docs/free-cloud-features
- Azure benefits: https://learn.microsoft.com/en-us/training/modules/create-an-azure-account
- Azure spend limits: https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit
- AWS Free Tier: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html
- IBM Code Engine: https://cloud.ibm.com/docs/codeengine?topic=codeengine-pricing
- GitHub runners: https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- Cloudflare Workers: https://developers.cloudflare.com/workers/platform/pricing/
- Render: https://render.com/docs/free
