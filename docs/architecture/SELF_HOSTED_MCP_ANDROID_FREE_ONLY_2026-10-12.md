# Grasshopper Free-Only Android Automation and Self-Hosted MCP Roadmap

**Status:** Research-backed architecture and implementation plan. No remote MCP listener published and no Google Cloud VM/OCI resources provisioned. User constraint: **ZERO BILLABLE**, see [policy](../operations/FREE_ONLY_CLOUD_POLICY_2026-10-12.md). Reviewed 2026-10-12 EDT.

## Verified production topology, not speculative

```text
Oracle Cloud (home region us-ashburn-1)
  OCI VM.Standard.A1.Flex: Grasshopper-Workstation  [2 OCPU, 12 GiB RAM]
    Oracle Linux 9.8 host / systemd, public 129.213.28.18
    /dev/sdb 114 GB persistent Android-data block volume (attached/mounted)
    /srv/grasshopper, ~33 GiB free
    / 47-GB boot volume (root logical volume has ~2 GiB free)
    nginx public 80/443 (existing: DO NOT DISRUPT)
    RustDesk self-host rendezvous/relay + console (existing, keep)
    Remote Desktop Commander device "grasshopper-workstation" (working)
    Google Cloud CLI, ADC and OCI CLI authenticated (live signed validation)
    agy (Google Antigravity CLI) v1.3.1, MCP endpoint "omnikali" configured
    Podman + QEMU guest "grasshopper-cloud-android-arm64"
       qemu-system-aarch64 TCG, 2 vCPU, 2 GiB guest RAM
       measured host QEMU RSS approx 3.1 GiB / 31% host CPU
    Kali XFCE **container on same OCI VM**, NOT independent free compute
       Remote Desktop Commander device "kali-workstation" (working)
       RustDesk client (working by operator confirmation)
       Kali overlay and persistent home on /srv/grasshopper (same storage)
       Remote desktop web viewer and noVNC
```

## Resource bottleneck and zero-spend constraints

- Oracle's Always Free landing page (checked live) says 1,500 OCPU-hours and 9,000 GB-hours per month = 2 OCPU/12 GiB full-month equivalent. Another Oracle page says 3,000/18,000 (inconsistent). **Treat 2/12 as the hard-safe limit until Oracle account eligibility is verified**. This machine already uses the full conservative allowance. Do not size to 4/24 or add extra A1 workers.
- Boot+block volumes = 47+114=161 GB / 200 GB free allocation. **39 GB left**, below minimum new-instance boot size of 47 GB; do not launch more VMs without approved storage restructuring.
- Compute is 80% idle in a single sample but memory tightly used: 8.2 GiB used, ~2.4 GiB available, ~1 GiB swap used, Android guest ~3.1 GiB host RSS. Do not spawn parallel Android emulators blindly; use sequential smoke and resource governor.
- Existing filesystem root is ~94% full; build containers/worktrees only on the 114-GB data volume after confirming paths and SELinux contexts, not boot root.
- Google Cloud billing is **DISABLED** on all four visible projects; no Google VM, Cloud Run or pay-as-you-go API deployment, despite published Google Free Tier allowances. Do not enable billing as a prerequisite.
- Read-only OCI Cost Analysis returned 11 entries and **$0.00** for Oct 1–11 UTC; zero historical cost does not insure against future costs.
- Oracle Always Free 20GB object storage, five volume backups, network load balancing, monitoring/notifications, up to 10TB monthly outbound data are *possible* next resources, but **unused and not deployed**. Verify entitlement/usage and backup data sensitivity before provisioning.

## Prioritize projects without new compute

Repository sources for design/lineage: `onnxscibroccoli/Grasshopper`, `broccoli-core`, `omnikali`, `grasshopper-kubernetes`, `omn-kali-knowledge-graph-master`, `helix`, `noVNC`, and `oauth2-proxy`. 30 account repositories visible in GitHub inventory; do not blanket-update them or erase in-progress work.

1. **Phase A — inventory and reproducibility:** pin live Android QEMU container command/drive/transport/build hash, working RustDesk and noVNC URLs, persistent OCI mount layout, Android guest health/smoke results. Back up config privately; do not reload/stop QEMU or Android transport. Snapshot exact local worktree status before edits. Verify cloud billing and Always Free policy at every agent session.
2. **Phase B — narrow local MCP tools:** Build a small rootless Node.js MCP server using the official 2026-07-28 **TypeScript SDK v2**, initially `stdio` and/or bound to `127.0.0.1`. Expose *read-only* tools first: `infra_status`, `resource_budget`, `android_guest_health`, `android_ux_snapshot`, `repo_status`, `knowledge_graph_lookup`, `smoke_status`. All tools return structured JSON with timestamps, device identity and confidence. No cloud-provider create/delete/update exposed.
3. **Phase C — fenced exec broker:** Add an allow-listed `android_test` tool whose worker executes only explicit test scripts in an OS-isolated container with cpu/memory/pids/timeout limits, low privilege, files mapped read-only by default and a separate private secrets mount. Enforce per-task signed request IDs, authorization, idempotence and audit log. **Observing an event must not replay the command or notification that caused it** (known Broccoli Core loop invariant). Interactive OAuth/CAPTCHA/biometrics stay user-mediated through a gated phone UI.
4. **Phase D — self-hosted Remote Commander alternative:** Reuse MIT-licensed **local** DesktopCommanderMCP where permissible, but **do not assume the hosted Remote Desktop Commander relay code is open source**. Build a separate minimal, auditable Streamable HTTP MCP gateway with device multiplexing, SSE/event streaming, OAuth 2.1+PKCE or an approved equivalent and narrow scopes. Service bound to loopback initially, with only approved project mounts. Kali container and host reached via Unix socket/private network; local host must not execute commands in container without declared target.
5. **Phase E — authenticated remote exposure:** Use existing nginx/TLS only **after** public reachability tests from physical Android, `/.well-known/oauth-protected-resource`/OAuth discovery, audience-bound tokens, strict `Origin` and `Host`, rate limiting, CSRF/session checks, HTTPS-only cookies, minimal audit retention and per-device kill switch. Existing noVNC and RustDesk remain recovery paths. Never expose unauthenticated command execution to public port 80/443.
6. **Phase F — Antigravity and collaborative agents:** Grasshopper already has `agy v1.3.1` and an `omnikali` remote MCP entry. Use `--mode plan` first, without `--dangerously-skip-permissions`; inspect its current authentication and free quota before sending model prompts. Only after peer-reviewed diff/tests should agent accept code edits, with no billing actions, no cloud deployments, and no destructive Android guest operations. Preserve the canonical knowledge-graph journal and acceptance artifacts.
7. **Phase G — two Android environments:** Original plan is production Android mirror + rooted development emulator, but this **cannot safely be concurrently provisioned** on current 2-OCPU/12-GB, 161-GB-allocated topology. Prioritize ONE active emulator (already running) and implement guest image snapshot/versioning, queued serial test runs, root-specific test modes; add further concurrent workers only after independently verified always-free capacity and no-billing boundary.

## Candidate open-source implementation and sources

- Local Desktop Commander MIT: https://github.com/wonderwhy-er/DesktopCommanderMCP
- Hosted RDC service **proprietary**; repository contains docs, manifests, public service tracker only: https://github.com/desktop-commander/remote-desktop-commander
- MCP TypeScript SDK v2 stable, Streamable HTTP and OAuth helpers: https://github.com/modelcontextprotocol/typescript-sdk
- MCP HTTP guide: https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md
- User repositories `onnxscibroccoli/noVNC` and `oauth2-proxy` may inform viewer/OAuth integration; audit fork status and licenses before reuse.
- Oracle Always Free: https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm
- Google Cloud Free Tier and billing eligibility: https://docs.cloud.google.com/free/docs/free-cloud-features

## Zero-billable acceptance gates

No new VMs, disks, buckets, load balancers, paid API calls, model tier upgrades or cloud projects. Local test steps must verify: production QEMU PID/transport untouched, peer session continuity, authenticated scoped tools, no secrets in logs, idempotent command dispatch, reconnect recovery, clean-checkout installer, reversible service startup, and memory/CPU safe bounds.

**Next concrete implementation output:** local read-only MCP server with 3 tools (`infra_status`, `android_guest_health`, `repo_status`) plus an end-to-end JSON-RPC tool-list + call test, running in isolated development directory on **/srv/grasshopper** with no public listener. Expand only upon verified security and budget gates.
