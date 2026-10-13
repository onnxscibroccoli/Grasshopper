# Microsoft Azure — Time-Limited B-Series Multiplatform Workers

**Account status: UNKNOWN. Do not deploy until free-account benefits and spending limit verified.** Azure's 12-month introductory benefit includes **750 hours/month per eligible VM shape**: `Standard_B1s` x86 (1 vCPU, 1 GiB), `Standard_B2ats_v2` AMD x86 (2 vCPU, 1 GiB), and `Standard_B2pts_v2` ARM (2 vCPU, 1 GiB). A 1 GiB machine cannot run full Android emulation. Associated OS disk, public IP, data transfer and support may have separate costs. Availability of shapes/zone quotas varies by subscription and region.

Official benefits: https://learn.microsoft.com/en-us/training/modules/create-an-azure-account ; spending limit: https://learn.microsoft.com/en-us/azure/cost-management-billing/manage/spending-limit

## Step-by-step

1. Open https://portal.azure.com/ in the phone browser, sign in with Microsoft/Entra ID and complete any signup/MFA on Microsoft's domain. If account doesn't exist, *you* choose free-account terms. Our software cannot input payment cards or agree to ToS.
2. In Azure Portal → Cost Management + Billing → Subscriptions, identify subscription type, start/end of 12-month benefits, credit balance and **spending limit**. An Azure Free Account generally has a credit-based spend limit (not a custom USD 0 cap) which can exclude third-party Marketplace charges; do not remove it or upgrade to unrestricted PAYG. If no enforceable protection, mark `BLOCKED`.
3. Install official Azure CLI on supported laptop/desktop, or use Azure Cloud Shell in the browser if Android Termux packaging is unsupported. Then authorize locally:
   ```bash
   az login --use-device-code
   az account list --output table
   az account show --output table
   ```
   Follow the provider's displayed URL/code on a trusted phone, never transfer codes through public workflow logs.
4. Region candidates for discovery: `eastus`, `eastus2`, `centralus`, `westus2`, `westeurope` (these are **not guarantees** of stock or free benefit). Query exact SKU/subscription:
   ```bash
   az vm list-skus --location eastus --size Standard_B1s --all --output table
   az vm list-skus --location eastus --size Standard_B2ats_v2 --all --output table
   az vm list-skus --location eastus --size Standard_B2pts_v2 --all --output table
   az vm list-usage --location eastus --output table
   ```
   For full subscription restrictions, inspect capabilities/restrictions in JSON, not only an abbreviated table.
5. For future approved trial use, Console → **Free services / Virtual Machines**; select eligible VM series, no paid Marketplace OS image, reviewed free disk tier, eligible region, private login, public IP costs checked. Three different SKUs may each have an advertised hour allowance **but benefits are subscription-specific and time-limited**; never assume three full-time VMs will cost zero without the provider Cost Analysis preview.
6. Choose OS: Ubuntu/Debian on x64/ARM for package compatibility; Kali image may carry marketplace premium fees. Safer to install sanctioned Kali tools in an ordinary free-eligible Linux VM/container rather than assuming a Kali marketplace image costs $0.
7. Post-deployment in a future stage: SSH behind private network, install Git/Python/Node testing dependencies only as needed; verify the two architectures, check Cost Analysis daily and ensure clean TTL termination **including disk/IP**. Azure's spend limit may stop/deallocate services when credit exhausted; it is not suitable as permanent infrastructure.

## Federated identity for GitHub

Microsoft Entra app registration + federated credentials can trust GitHub OIDC for protected repository/environment. Entra administrator authorizes this **once** per connection; subsequently workflows use ephemeral tokens, not a saved card or user password. No Actions job should get `id-token: write` until the narrowly scoped trust is configured and manually reviewed. See https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-azure

**Status for planner:** `NEEDS_ACCOUNT_REVIEW` → `CREDIT_TRIAL` → only `VERIFIED_FREE` if all dependent services and hard protection checked. The v0 code does no provisioning.
