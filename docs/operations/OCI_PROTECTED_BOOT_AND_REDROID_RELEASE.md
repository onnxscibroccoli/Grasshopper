# OCI protected desktop boot and Redroid release contract

**Status:** Proposed, not deployed. A single-host kernel reboot has nonzero downtime; objective is an accepted, bounded interruption and automatic recovery, not an unverified zero-downtime assertion.

## Verified current state (2026-10-13)

- Grasshopper VNC, noVNC, and MCP already run as enabled, active systemd units with automatic restart. Preserve those exact units.
- Remote Desktop Commander uses a cached v0.2.52 executable under the Grasshopper user. It works now; an enabled system service for RDC is not yet proven.
- Kali Remote Desktop Commander runs in a separate environment. Kali PID 1 was observed as vncserver, not systemd. The underlying **host container restart policy** must be verified using privileged inspection before claiming Kali recovery after a host reboot.
- Existing QEMU Android, nginx, RustDesk, and the browser-based access paths are protected. Redroid is not deployed.
- Binder compatibility: Oracle UEK 6.12 lacks Binder. Out-of-tree Redroid PR #21 did not link because zap_page_range_single is not exported; never replace it with zap_vma_ptes without correct VM mapping semantics.

## Implemented in this candidate PR

1. A guarded, non-root, pinned-version systemd service installer for Grasshopper RDC. The script stages and validates before deployment, checks protected services, enables a *new* service for the next boot only, and does **not** restart any working access service or initiate reboot.
2. Optional **exact-command sudoers delegation** only for status, is-active and restart of grasshopper-rdc.service. No unrestricted passwordless sudo, root shell, or credential storage. Requires a separate local operator-approved sudo invocation.
3. A read-only post-boot acceptance script checks existing protected services, viewer loopback HTTP and attached storage. Actual desktop rendering and Kali authentication require independent acceptance.
4. A GitHub Actions static CI workflow checks executable contracts, systemd syntax, unit hardening, and fail-closed operator privileges. Green CI is not proof of live post-reboot acceptance.

## Human approval and milestone gates

**M0 — CI:** Run the GitHub Actions boot-unit tests, with no cloud credentials or sudo password supplied.

**M1 — Operator install, after code review and merge to main:** On the remote Grasshopper terminal, the operator runs:

    cd ~/src/Grasshopper
    python3 scripts/desktop-access/guarded-boot-setup.py audit
    sudo -v
    sudo python3 scripts/desktop-access/guarded-boot-setup.py install --entry /home/grasshopper/.npm/_npx/4b4c857f6efdfb61/node_modules/@wonderwhy-er/desktop-commander/dist/index.js
    systemctl is-enabled grasshopper-rdc.service

Only if the operator explicitly wants three whitelisted sudo recovery commands, add --allow-recovery-sudo to the install command, after reviewing its exact authorization implications. Never copy the actual password, root session state or API credentials to GitHub or an agent transcript. Do not run install before CI passes.

**M2 — Recovery:** Verify Kali container host restart policy, separate out-of-band OCI console/recovery route, old kernel boot entry, backups and independent RustDesk/browser access *before* scheduling a reboot.

**M3 — Oracle UEK patch:** Build a complete vendor-matched in-tree Binder/BinderFS kernel from the signed exact source and config, verify artifact digest, ABI, modules, initramfs, SELinux boot assumptions and an isolated VM boot test. Binder object compilation is not a deployable kernel.

**M4 — Privileged install:** Run a separate reviewed kernel installation procedure with operator interactive sudo and rollback entry. Do not give Remote Desktop Commander a general root credential. Reboot only with explicit authorization. Measure recovery of both Grasshopper and Kali, and test real keyboard/desktop viewing.

**M5 — Redroid:** Only after real Binder device proof and the guarded resource gate pass, configure separate Podman image/data storage on the attached volume and launch one persistent ARM64 Redroid container with host-only ADB on 127.0.0.1. Accept only full Android boot, screen/IME, persistence and replay-safe Grasshopper integration. Retire QEMU only after migration.

**M6 — Reusable bots:** Save successful, deidentified agentic task loops as review-gated reproducible bots in the central knowledge graph. Use milestone check-ins instead of interrupting every technical iteration. Pause immediately for privileged, destructive and authentication gates.

## Non-negotiable constraints

Read repository source exclusively from main; never use raw commit SHA as a source retrieval ref. Existing productive infrastructure remains untouched until independently proven replacement. Do not expose account data or private contact details. A positive process-exists response is never sufficient proof of a working remote desktop.
