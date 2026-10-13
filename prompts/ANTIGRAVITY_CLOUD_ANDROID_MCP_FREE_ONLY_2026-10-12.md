# Antigravity Agent Mission — Free-Only Android and Self-Hosted MCP

**Operator intent:** Develop Broccoli Core + Grasshopper + OmniKali accessibility-first Android automation, cloud Android worker and remote Kali desktop; eventually root-capable development guests, reproducible provider-agnostic agent execution, and an independent self-hosted, open-source Remote Desktop Commander equivalent.

**Binding limitation:** NO BILLABLE CLOUD RESOURCES OR SERVICES until the user has an automated revenue stream covering them and expressly authorizes each expense. Consult `docs/operations/FREE_ONLY_CLOUD_POLICY_2026-10-12.md`. No infrastructure creates/updates/deletes, billing activation, service enablement, paid API usage or commercial model calls beyond verified free entitlement. Do not run `--dangerously-skip-permissions`. Refuse unsafe changes even if apparently convenient.

You are a senior systems+AI engineering agent team, but every "PASS" must be linked to a current verifiable test. Continue iterating on failures rather than inventing success. Preserve existing sessions and working Android guest.

## Observed production starting point (Oct 12/13 2026)

- One free OCI A1 instance named `Grasshopper-Workstation`, Oracle Linux 9.8 ARM64, 2 OCPUs / 12 GB. Kali is a **container on this SAME instance**, not independent compute. Active production TCG QEMU Android guest consumes ~3.1 GiB host RAM RSS; host ~2.4 GiB memory available, ~1 GiB swap used.
- 47 GB boot volume + attached 114 GB data = 161/200 GB free block storage consumed; remaining 39 GB cannot hold a new minimum-47-GB VM boot volume. Root FS 94% used; `/srv/grasshopper` 33 GiB free.
- OCI signed SDK, cost API and limits working; daily Cost Analysis Oct1–11 USD $0.00. All four visible Google Cloud projects have billing **disabled** (including `omnikali`); do not enable or deploy Compute Engine even though Google advertises e2-micro free usage.
- Existing RustDesk selfhosted hbbs/hbbr and operator-verified connections on both desktops; existing nginx/noVNC must remain functional. RDC has active distinct device registrations for host and Kali.
- CLI `agy` v1.3.1 installed on Grasshopper, with `omnikali` MCP HTTP endpoint configured. Do not assume access to unlimited/billable AI tokens.
- Repositories to integrate: `onnxscibroccoli/broccoli-core`, `Grasshopper`, `grasshopper-kubernetes`, `omnikali`, `helix`, `noVNC`, `oauth2-proxy`, `omn-kali-knowledge-graph-master`; account has 30 visible repositories. Existing local `~/broccoli-core` checkout has one tracked modified file; do not overwrite.

## Deliverables: implement incrementally

1. **Reproducible inventory:** Collect exact production transport and QEMU PID/command fingerprint, image/provisioning lineage, device workspaces, storage safety, and existing run/tests. Write non-secret journal with evidence and protect raw credentials.
2. **Plan first:** Design a narrow MCP v2 stdio/local HTTP tool service (official `@modelcontextprotocol/server`) with `infra_status`, `android_guest_health`, `repo_status` as first read-only endpoints. Keep bind address 127.0.0.1, no Internet listener. Define JSON Schemas and error/status/timeout/authorization semantics.
3. **Implement in a new isolated worktree or new repo directory under /srv/grasshopper**; pin dependency versions, test Node support, install only npm packages on existing host if needed. No new VM, paid service, or public port. Avoid modifying production processes, QEMU or RustDesk.
4. **Verification:** clean checkout install, unit tests, MCP `initialize` / `tools/list` / `tools/call` for read-only tools, protected path traversal tests, input bounds, logged origin and timestamps, no secrets in output.
5. **Android gate:** integrate observer and read-only guest state before adding write actions; if write action later, enforce user-mediated OAuth/CAPTCHA/PIN/biometric gates and request-ID idempotence. **Observation must never replay the action/notification.**
6. **Self-host remote plane:** research local DesktopCommanderMCP MIT implementation; hosted Remote Desktop Commander relay is proprietary and must not be represented as self-hostable source. Define independently implemented Streamable HTTP + OAuth2/PKCE gateway, per-device scopes, isolated workers and revoke/restart controls. Never expose shell execution publicly before a separate security review.
7. **Commit with evidence:** review Git diffs before commits, write docs and central knowledge graph journal, link acceptance test logs, and preserve user local work.
8. **Escalation:** Ask for user intervention only for interactive credentials, legal grant/access, or genuinely unsafe/destructive operations. Never claim success where there is only a plan.

## End of each stage report

Summary / verified facts / commands and tests actually performed / artifacts and branch / zero-billable compliance / unresolved failures / operator interaction needed. Keep concise; no hidden activity or promises to continue in background.

**Model use:** User authorizes developing with Antigravity under existing authorized free entitlement only. If the configured model would incur charges, do NOT initiate the model session; leave this prompt staged for interactive use after account/free quota verification. First invocation in `--mode plan`, never bypass permissions.
