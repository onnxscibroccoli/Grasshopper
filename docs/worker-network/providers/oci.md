# Oracle OCI — Always Free VM and Grasshopper/Android Coordinator

**Deployment state: EXISTING HOST LIVE; extra VM creation BLOCKED by conservative free limits and storage.** Oracle Always Free shapes are in the tenancy's **home region** only. Current verified home region `us-ashburn-1`, the only subscribed region in this account. The single A1 host already runs Grasshopper, a Kali container, a production QEMU Android worker, RustDesk, and noVNC.

## Eligibility / exact sizes

- ARM64 `VM.Standard.A1.Flex`: Oracle's currently verified primary policy: **1,500 OCPU-hours and 9,000 GB-hours per month**, 2 OCPUs/12 GiB memory continuous equivalent on Always Free tenancy. This is pooled among A1 VMs and not multiplied by ADs. Never interpret the 41-OCPU *service quota* as a free allocation. Capacity may be unavailable.
- x86-64 `VM.Standard.E2.1.Micro`: up to **two** tiny AMD micro instances. Not suitable for Android emulation and constrained to one designated availability domain in multi-AD home regions.
- Combined Always Free boot + block volumes: **200 GB total** home-region-only, maximum 5 eligible backups (not a free 200 GB *per instance*). Current API snapshot: boot 47 GB and attached data 114 GB = **161 GB** allocated; only **39 GB** remains. Oracle's documentation currently describes minimum boot volume **50 GB** for a new instance: not enough headroom without safely freeing existing storage.
- Object Storage: up to 20 GB on eligible account (class distribution varies by trial/account type); verify included request/data-transfer limits and region first.

Reference: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm

## Step-by-step: connect an existing phone or Linux workstation

1. Sign in to the **official OCI Console**, https://cloud.oracle.com , using the tenancy's configured identity domain and MFA. Complete provider verification on the provider site. Never enter Oracle credentials into this toolkit.
2. Install the official Oracle CLI from Oracle's current platform instructions. Grasshopper already has CLI 3.94.1; Android previously had 3.94.2. Do **not** reinstall a working toolchain just to set up OAuth.
3. For an existing Grasshopper desktop session, run `oci session authenticate --region us-ashburn-1 --profile-name OMNIKALI` in its GUI terminal. Finish the Oracle browser OAuth. On a headless terminal, use Oracle's documented token-device process, not a guessed redirect. Store profile/private token directory mode 0700/0600.
4. Verify without copying or echoing tokens:

   ```bash
   oci session validate --local --profile OMNIKALI --auth security_token
   oci iam region-subscription list --tenancy-id "$TENANCY_OCID" --profile OMNIKALI --auth security_token --output table
   ```

   Replace `TENANCY_OCID` locally from a trusted config/CLI result. Do not publish the full OCID in a public log. OCI browser session tokens expire and may need periodic reauthentication/refresh.
5. Inspect **all compartments/regions** before relying on a free budget. On Grasshopper use the tested `grasshopper-oci-audit.py` and `grasshopper-free-only-preflight.py` (existing files) in read-only mode. Verify the A1 OCPU/memory and each boot/block volume.
6. In OCI Console: **Compute → Instances → Create Instance** *only if the independent Free Tier/usage and 50-GB+ boot storage gate passes*. Choose an explicitly marked Always Free `VM.Standard.E2.1.Micro` in a supported AD, or share existing A1 through containers. Keep additional disks/monitoring/images/network resources within verified free limits. Set SSH public key; do not open SSH to the world.
7. Before any provisioning, calculate worst-case 31-day OCPU- and GB-hour allowance, *including* existing A1, powered-off volumes, all ADs and backup quotas. Confirm resource marked Always Free in console and provider account status is Free Tier. Select only reviewed console values; no auto-click setup in our scripts.
8. After an approved free allocation in a future implementation, verify resource tags, instance state, firewall, block-attachment state, mount, hourly usage, actual Cost Analysis, SSH and reconnection; document rollback and total allocated storage. Do not destroy the current QEMU, Kali or RustDesk access.

## Grasshopper-specific hard stops

`2 OCPU/12GiB` already in use; persistent boot/data allocation 161/200GB. Therefore **no additional VM** will be created now. Preferred worker expansion is self-hosted **containers** and sequential test runs on the one A1 VM, plus ephemeral GitHub runners. A resource-availability API response of `available:39 cores` is not a free entitlement. An extra Always Free instance cannot be considered until disk footprint and account eligibility are reassessed. OCI Usage API's USD $0 observed Oct 1–11 is historical only and does not guarantee billable absence.

## Android guest and tests

- Preserve production QEMU command, image lineage, guest screen transport and private port mappings. Test ADB/IME/clipboard and guest health by **read-only** smoke first. Do not start parallel QEMU guests on 2 OCPU without resource budget.
- Keep raw OCI disk inventory privately; don't expose volume IDs, tokens, security list, serial consoles or websockify token publicly.
- When writing MCP, bind to `127.0.0.1` / protected host-container socket until identity, TLS and scopes are independently tested.

**Human action required:** only future creation/deletion/volume reallocation or failed Oracle OAuth; no spending approval is requested by this guide. **Source:** https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/clitoken.htm
