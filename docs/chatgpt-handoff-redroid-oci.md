# Redroid on OCI — Privacy-Safe Agent Handoff

**State (2026-10-13):** Redroid not deployed. This document describes observed facts, safety gates and the implementation target; it does not claim boot success.

## Source and privacy rules

- Read repository source **only from** the canonical **`main`** branch. Never fetch raw Git commit-SHA refs, other branches, unreviewed forks or salvage worktrees as authority.
- Write proposed source or documentation to an isolated feature branch derived from `main`; require approval before merging.
- **Do not commit personal details:** names, private contact information, medical information, credentials, SSH/API keys, session tokens, bank or account data, or authenticated Android images.
- Keep operational evidence deidentified. Before each commit, run a content scan for privacy and secrets; reject candidate artifacts with direct identifiers. A history rewrite is a separate, coordinated decision.

## Core outcome

Provide a persistent Android container on the existing **OCI Always Free ARM64** workstation to support accessible cloud-based application interaction. Integrate this with Broccoli Core's provider-neutral semantic UI model and an event-driven execution/control schema, plus Grasshopper's lifecycle manager and Android companion security gateway.

Three first-class operation targets must remain supported: (1) physical Android, (2) cloud Android, (3) cloud Linux/Kali applications remotely windowed onto physical Android. Text/chat, voice and semantic automation share the same capability-scoped action schema. Every device should be able to dispatch work to authorized APIs, MCP servers, model providers or other devices. Sensitive authentication and purchases must be gated by secure user approval. Do not replicate raw passwords or account tokens across devices.

## Observed OCI production topology

The live host is **Oracle Linux 9.8**, **aarch64**, **UEK `6.12.0-206.104.4.4.el9uek.aarch64`**. It is **not Ubuntu 24.04/kernel 6.17** as older documentation presumed.
- VM: 2 OCPU, 12 GiB configured.
- About 3.4 GiB memory available in the sampled state; existing QEMU ARM64 Android guest consumed ~2.8 GiB RSS and did **not** run Kali.
- `/srv/grasshopper` is an attached persistent data filesystem, about 33 GiB free; boot/root filesystem is about 94% occupied.
- No Binder devices were present; matching kernel development headers were absent.
- Podman currently runs rootless with image storage on the constrained boot/root filesystem.
- Existing Kali and Grasshopper desktops, nginx/HTTPS/noVNC, RustDesk and recovery routes are protected infrastructure. Neither QEMU nor Redroid is a substitute for those services.

## Ordered deployment and retirement gates

1. **Snapshot evidence, not private user data.** Inventory the old QEMU process, service dependencies, disk filenames/types/sizes, Android boot signal, access paths and resource usage. Record sanitized test results and observed failures.
2. **Authorize selective reclamation.** The operator permits removal of *verified nonfunctional* Android QEMU experiments after engineering findings are documented. Do not touch QEMU if it supplies Kali or a working production/recovery access path. Do not publish raw Android disks or account caches in any GitHub repository, including public trash repositories.
3. **Verify baseline.** Record remote desktop/noVNC/HTTPS/RustDesk processes and endpoint health before and after every retirement step. Avoid touching host ingress 80/443, nginx, RustDesk service keys, Kali container mounts, OCI partitions or active backup directories.
4. **Binder readiness.** Determine viable Binder module/build strategy for the *actual* Oracle UEK 6.12 kernel with available privileged host access. The `androidboot.use_memfd=1` option can avoid ashmem, but Binder is mandatory. Verify `/dev/binder`, `/dev/hwbinder` and `/dev/vndbinder` before container startup.
5. **Resource admission.** Reserve host memory for existing workstations and services. Put Redroid image layers and persistent `/data` under the existing `/srv/grasshopper` filesystem, after verifying image-store configuration, SELinux compatibility, disk budget, operator permissions and rollback. Do not run concurrently with resource-heavy QEMU.
6. **Secure launch.** Start one official compatible ARM64 Redroid image, with bounded CPU/RAM and persistent /data. ADB must bind **127.0.0.1** only (proposed host 5556, guest 5555). Connect through authenticated SSH tunnels, not a publicly exposed TCP socket.
7. **Acceptance.** Verify Android release and `sys.boot_completed=1`, responsive local ADB, home screen display, keyboard relay, authenticated application sessions, reboot/reconnect survival, metrics and a restore test.
8. **Broccoli/Grasshopper integration.** Map semantic UI nodes, app/window state, model-independent intended actions, device target, execution status, capability grants and user-authentication gates to a common event bus. Forbid re-executing originating commands from observation events. Track confidence, action IDs, idempotency and audit/redaction.

## Privacy, cost and implementation constraints

- **Zero-billable:** no new VMs, resized instances, paid storage/backups, additional billable egress or billing activation without separate approved authorization.
- **Main-only reads:** public code/documentation inspections always specify `main`; no history-diff content reads from raw SHA refs.
- **Sensitive data:** private images, secrets and sessions stay in protected on-host storage and encrypted operator backups, never public GitHub.
- **Proof-driven:** do not describe module compile, boot, container persistence, GitHub merge, connection test or storage recovery as PASS until supported by a command output and acceptance evidence.
- **Operator authority:** all merges require review; shell-level irreversible deletions must be narrowly scoped to verified obsolete artifacts.

## Canonical source docs (always open on main)

- `docs/redroid-implementation-log.md`
- `docs/operations/FREE_ONLY_CLOUD_POLICY_2026-10-12.md`
- `BASE_SYSTEM_PROTECTION.md`
- `docs/architecture/SELF_HOSTED_MCP_ANDROID_FREE_ONLY_2026-10-12.md`
- `README.md` and `.omnikali/project-knowledge-graph.md`

Upstream references: Redroid documentation and Redroid kernel modules from their own default main branches. Do not treat a different operating system's compile report as proof of support on Oracle Linux UEK.
