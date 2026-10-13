# ZERO-BILLABLE CLOUD OPERATIONS POLICY — Grasshopper / OmniKali / Broccoli

Status: **MANDATORY** for all development and agent automation, adopted 2026-10-12 EDT.

## Immutable operating constraint until separate written authorization

**No billable cloud resource, service, model usage, storage, network egress, license, or API consumption.** No upgrade, conversion to Pay As You Go, billing activation, account linkage, quota increase, resource that might exceed an Always Free allowance, GPU, disk snapshot, or external AI/model subscription without **specific user authorization supported by a documented, automated revenue source that covers the new cost**. Zero observed usage today is not a guarantee of zero future cost.

Tools may execute read-only inventory, cost checks, CLI tests, non-deploying plans, local script edits and documentation. Production cloud mutations are blocked by policy unless per-resource entitlement, Free Tier consumption and safe rollback are positively established; if in doubt **fail closed** and request explicit authorization. Ordinary provider service quotas are **NOT** evidence of free entitlement.

## Directly verified OCI evidence — us-ashburn-1, live Grasshopper CLI SDK, Oct 13 2026 UTC

- OCI profile `OMNIKALI`: signed IAM, limits, cost, storage and instance queries PASS.
- One region subscribed, one Grasshopper compartment plus tenancy root, **one** OCI compute instance `Grasshopper-Workstation` in AD-1; `VM.Standard.A1.Flex` RUNNING, **2 OCPU / 12 GiB configured**.
- The Kali desktop is an OCI-hosted **container within this same instance**, not a separate VM. Both RDC endpoints show the same kernel/memory statistics, and host inventory shows one instance. Host additionally runs CPU/software-emulated Android QEMU under Podman.
- One **47 GB boot volume**, one **114 GB block volume** named `grasshopper-cloud-android-data` with a paravirtualized **ATTACHED** resource attachment; **161 of 200 GB** Always Free block/boot volume budget allocated, **39 GB unallocated**.
- Within guest: `/srv/grasshopper` mounted from `/dev/sdb` with ~33 GiB free; container Kali overlay/home storage is on this same underlying mounted volume. Host `/` has only ~2 GiB free and is **94% used**.
- Tenancy root/Grasshopper: **0 Object Storage buckets**, **0 boot or block volume backups**, **0 load balancers**, **0 network load balancers**. One VCN, one subnet, one primary VNIC.
- OCI Resource Availability API reported A1-core count: 2 used, 39 available against a *service quota* of 41 per AD; **that 39 is not free entitlement**. Compute region limit 16 is also not Always Free allowance.
- OCI Usage API with `COST` daily, 2026-10-01 inclusive through 2026-10-12 exclusive: **11 entries, total USD $0.00**. September completed monthly query returned zero entries. These data can lag or omit unreported charges. Verify in OCI Billing before any mutation.

## Published OCI Always Free references and conservative limits

Primary reference: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

**At the time of audit, this primary page explicitly documents 1,500 free A1 OCPU-hours and 9,000 GB-hours monthly, equivalent to 2 OCPU / 12 GiB.** Another Oracle page states 3,000/18,000; the documentation is inconsistent. To enforce user-requested **zero billing**, the **stricter 2-OCPU / 12-GB cap controls** until Oracle and the tenancy billing status explicitly resolve that discrepancy. Currently **100% of this conservative free A1 allocation is in use**. DO NOT increase the VM shape to 4 OCPUs / 24 GiB or launch more A1 VMs based on ordinary resource quotas.

The same published Always Free page documents:
- Up to **2 AMD VM.Standard.E2.1.Micro** instances, subject to available AD, boot disk space and capacity.
- **200 GB** combined boot+block volumes in the tenancy's *home* region, plus up to **5 free backups**. `39 GB` remaining is below the documented minimum **47 GB** boot volume for one more VM, so there is **no safe extra VM today** without a reviewed storage reallocation.
- **20 GB Object Storage** free allowance (storage class split depends on account status); **0 buckets currently**, capacity not yet consumed. Separate storage operation/transaction/egress limits still apply.
- Up to one Always Free 10 Mbps flexible load balancer (creation/account-age dependent), one network load balancer, free Monitoring/Notifications within caps, and **10 TB monthly egress**. Never infer that LB from `lb-flexible-count` general service quota is free; check explicit Always Free tag/account eligibility.
- Always Free compute instances can be reclaimed if all documented utilization thresholds are low over seven days; monitor legitimate utilization and workload health, never generate meaningless load.

## Directly verified Google Cloud billing status, read-only Grasshopper gcloud Oct 13 UTC

| Google Cloud project | `billingEnabled` | Billing account linked? |
| --- | --- | --- |
| `omnikali` | **false** | no |
| `gen-lang-client-0063997183` | **false** | no |
| `gen-lang-client-0111597832` | **false** | no |
| `project-2ce61e7b-49cc-43d3-ab8` | **false** | yes, but **disabled** |

Therefore **do not enable billing** or deploy Google Cloud VMs/Cloud Run/API services. Authentication is functional but is not permission to incur usage costs. Google's Always Free E2 micro requires an eligible active Cloud Billing account. The eligibility constraints are documented at https://docs.cloud.google.com/free/docs/free-cloud-features ; Google budgets/alerts are not guarantees of zero cost. Account-paid services and spend-cap budget enforcement can lag. Use existing no-charge developer workflows (local repos, supported Cloud Shell free allowance and on-instance tooling) as appropriate without enabling billing.

## Safeguards implemented immediately

1. **Plan/report only** for Google Antigravity or other agents until cloud-spend controls and provider entitlements have been validated. In agent prompts require no deployments, no infrastructure creation and no auto-approval of cloud mutations. Do NOT pass `--dangerously-skip-permissions`.
2. Never use provider general `limits` counts as proof of free capacity. OCI `compute.used` and Free Tier entitlements must be independently checked.
3. Preserve running Grasshopper, Kali, RustDesk, Android QEMU, Git worktrees and all credential files. Never stop/reboot/resize without a verified restore plan.
4. Prefer **containers on the existing A1 instance**, sharing its persistent `/srv/grasshopper` data volume. Keep services bound to 127.0.0.1/private network; expose remote MCP only after TLS, OAuth/token exchange, request scoping and host isolation. Existing CPU 2 OCPU and RAM 12 GiB are tightly shared; do **not** add second QEMU/Android guest until resource budget and acceptance tests are green.
5. Root disk has ~2 GiB free: build caches, container images and Android SDK/emulator files should be placed on existing `/srv/grasshopper` volume only after inspecting overlay mount design. Do not relocate without snapshots and proof of restore.
6. Do not create object buckets, backups, monitoring exports, load balancers, micro VMs or Google Cloud resources during this read-only planning phase; investigate exact costs, account entitlement and storage/retention first.

## Promotion requirements for a resource from PROPOSED to ALLOWED

Must document: service, exact shape/tier and region, official **Always Free eligibility**, free usage baseline, existing allocations including all compartments/projects, worst-case month at 31 days, network/storage/transaction quotas, billing switch status, preservation and rollback, monitoring and budget alerts, explicit approval. If any unknowns remain: **BLOCKED — ZERO BILLABLE**.

## Design priority

Use current Oracle host as coordinator/MCP gateway and local graphical workstations. Isolate Android guest in container or VM with bounded CPU/memory; use Gemini/Antigravity agent **planning** through already-authorized plans only. A free Google compute instance is not deployable under the current GCP billing-disabled state. Revenue-funded paid resources are a **future explicit milestone**, not implied by completing this audit.
