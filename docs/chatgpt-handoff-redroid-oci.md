# Redroid OCI Handoff — Deidentified Operating Contract

**Current status (October 13, 2026):** OCI browser authentication has been validated. Redroid is not yet deployed, and kernel Binder compatibility remains blocked. This public handoff contains no personal identifiers, secret material, OAuth callback URLs, access tokens or authenticated device images.

## Authority and privacy
- Read project source only from the repository's `main` branch, not historical raw commit SHA URLs or unmerged branches.
- Changes go to isolated feature branches and require explicit human approval before merge.
- Never commit contact information, health information, login credentials, payment information, or private Android app data.
- Only an authenticated operator completes OAuth, biometric, verification, CAPTCHA or payment gates. Workers receive narrowly scoped approvals, not user passwords.

## Product target

Build one persistent Redroid ARM64 cloud Android worker on the existing **OCI Always Free** workstation and integrate it with Grasshopper/Broccoli Core for semantic, agentic Android and Linux/browser controls. Preserve existing accessible Kali, Linux and Android remote sessions and their recovery channels. Prioritize free/open-source, self-hosted architecture, chat/voice control, runtime privacy filtering, and idempotent event-driven actions.

## Verified host and blockers

- Oracle Linux 9.8 ARM64; running kernel `6.12.0-206.104.4.4.el9uek.aarch64`.
- `CONFIG_ANDROID_BINDER_IPC` is disabled. No Binder character devices exist; `CONFIG_MEMFD_CREATE=y`.
- Root filesystem is constrained; the persistent `/srv/grasshopper` data volume has approximately 60 GiB free following a measured 27.03 GiB reclamation of **inactive** QEMU experiment directories. The still-responding Android QEMU guest and Kali were preserved.
- OCI CLI `OMNIKALI` security-token session and a signed API call validated. The OCI Run Command plugin was listed RUNNING, but a harmless privilege probe remained `ACCEPTED`; **host root privilege has not been proven**.
- Redroid upstream kernel 6.8+ PR #21 is not directly compatible with Oracle UEK 6.12. Diagnostic compilation reached `MODPOST` but failed because `zap_page_range_single` is not exported to third-party modules. Blind use of `zap_vma_ptes` is unsafe for Binder's non-`VM_PFNMAP` mappings.
- Oracle's exact matching source RPM was obtained from its published repository and signature-verified on the private data volume. A candidate config enabling in-tree Binder/BinderFS was generated without modifying the running kernel. A public, free ARM64 CI probe was proposed to test source compilation before building a deployable vendor kernel.

## Execution gates

1. Maintain healthy external and local access to Grasshopper/Kali, nginx HTTPS/noVNC, RustDesk and active QEMU Android.
2. Resolve Binder using a vendor-compatible, tested **in-tree** Oracle UEK build or a comprehensively validated external alternative.
3. Validate privileged host access and out-of-band recovery before kernel installation/boot changes. Never reboot merely because a compile succeeded.
4. Configure an isolated container image store on `/srv/grasshopper` and apply a strict resource admission policy.
5. Launch one Redroid instance with persistent private `/data`, no public ADB, host `127.0.0.1:5556`, and `androidboot.use_memfd=1` where supported.
6. Verify `sys.boot_completed=1`, authorized ADB, Android 16, human-visible screen, real keyboard input, reconnect, reboot persistence, recovery and no impact on existing desktop services.
7. Integrate Broccoli's semantic UI graph, typed action schema, approval gateway, provider-neutral model/API/MCP adapters and event ledger. Observing an event may **not** replay the originating command.

## Current sources on main

- `docs/redroid-implementation-log.md` (prior status may be stale until its proposed correction merges).
- `README.md`
- `AGENTS.md`
- `BASE_SYSTEM_PROTECTION.md`

Proposed reviewed engineering updates and evidence are in draft Grasshopper PR #189. No work in that draft is automatically production-ready. A privacy-safe current file replacement does **not** remove previously exposed historical Git objects or caches; coordinate those separately with explicit approval.
