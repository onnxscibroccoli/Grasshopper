# OCI Redroid Release: Zero-Avoidable-Downtime Gates

**Status:** Candidate contract and CI-only checks. **NOT_PROVEN for production.** Do not reboot, stop the existing Android QEMU, replace the host kernel, or claim browser/companion input works merely because this document exists.

## Why Redroid

Redroid runs Android's userspace natively on the Linux **ARM64** kernel. It removes the QEMU TCG CPU emulation penalty but requires a kernel with Android Binder/BinderFS, memfd or ashmem, IPv6, DMA-BUF/ION and compatible page size. The actual OCI production host is **Oracle Linux 9.8, UEK `6.12.0-206.104.4.4.el9uek.aarch64`**; it presently has **no** `/dev/binder`, `/dev/hwbinder` or `/dev/vndbinder`. The external Binder module experiment hit an unexported symbol. An in-tree vendor-matched kernel candidate and **real boot/rollback test** are prerequisites, not an automatic production installation.

The purpose is a persistent cloud Android accessible through:
- An authenticated **browser** remote-screen gateway, with responsive phone-sized display, landscape/portrait, native keyboard text relay, mouse/touch events, and lossless reconnection. A functional scrcpy/noVNC window in Linux is an acceptable **temporary fallback**, but does not prove a new native browser transport.
- The approved Android **companion application**, with session-bound biometric/human authorization, protected remote control, local screen input/IME relay and return to the physical phone.
- A constrained **agentic automation transport**: policy-approved typed actions, semantic accessibility observation and event correlation, auditable non-replayable receipts. An observation event never re-executes its originating command.
- A **development/Test environment**, including Termux shell and Android tools where possible, and separately the real physical Android 15 Termux/Shizuku environment.

## Android version and device-test fidelity

The physical Samsung A14 runs **Android 15 (API 35), ARM64**. The proposed Redroid build is **Android 16 (API 36), ARM64**. Android 16 success alone **does not prove** Android 15 compatibility or Shizuku/rish behavior on the physical phone.

Use three distinct testing lanes:

| Lane | Scope | What it cannot prove |
| --- | --- | --- |
| GitHub Actions hosted Android 15 emulator (`redroid-release-acceptance.yml` manual dispatch) | API 35 framework/property checks and supported instrumentation once test APKs are added | Physical ARM64 SoC, Shizuku/rish, biometric flow, remote keyboard |
| Redroid ARM64 on OCI | API 36 boot, persistent `/data`, screen/IME/browser/companion, private ADB, policy-governed UI automation | Android 15 physical parity |
| Real Android 15 Termux (`termux-physical-parity.sh`) | Model/ABI/API35, installed Java/Python/git/ADB, Shizuku/rish shell identity, local build prerequisites | Any particular application test unless that same test APK and assertions run there |

No payment apps, user credentials, biometrics or live personal sessions are used as test fixtures. Build a dedicated **test-only APK** with a text field and deterministic echo for full browser/companion keyboard round-trip acceptance; do not use a production password field.

## Build and release dependency graph

1. **Protect production baseline.** Capture `systemctl is-enabled/is-active`, `Restart=` policy, nginx+noVNC/RustDesk/MCP connectivity and separate Kali workstation transport. Confirm non-console RDC fallback from a *different* client, not only a unit's PID. No downtime is admissible yet.
2. **Restore recovery.** Verify cloud serial-console/OCI rescue access, previous working kernel boot entry, durable encrypted backups, clean rollback artifact and root-volume free space. Root currently has low headroom and `/srv/grasshopper` is the safe build-data filesystem. If Kali's VNC/RustDesk/noVNC processes are ad-hoc rather than boot-enabled, stage reviewed systemd units through interactive operator sudo, then recheck without restarting live sessions.
3. **Produce the Oracle UEK kernel candidate in CI.** Verify exact official SRPM signature+hash, apply Binder/BinderFS as an in-tree kernel feature (not broken third-party module ABI), assemble reproducible ARM64 kernel artifacts and hash/sign the output. CI object compilation is necessary but **insufficient** for host boot acceptance.
4. **Test kernel outside the only production workstation.** Use a disposable, isolated Oracle Linux 9 UEK-equivalent VM with recovery, verify Binder character nodes, binderfs, memfd and full Redroid boot. If unavailable, record `NOT_PROVEN` and block production.
5. **Stage Redroid on dedicated data volume.** Pin image digest; isolate `/data`; use a private 127.0.0.1 ADB listener. Do not publish ADB directly or use mutable `latest` image as production provenance. Restrict the container's CPU/RAM so desktop/RDC access remains viable.
6. **Run the live Android acceptance harness** `redroid-acceptance.py live-adb` at `127.0.0.1:5556`, which only checks Android build/boot, size and density. This alone does **not** prove browser/app use. Collect separate browser and companion keyboard receipts, agentic action receipts, container-restart persistence, reconnect and external device access. Compile and run one deterministic test APK across Redroid and physical Android15 Termux as permitted.
7. **Only if all the above have real evidence:** request the operator to run a reviewed, checksum-matched, host-local `sudo` installer at an explicit maintenance window. Do not store sudo passwords or root bearer tokens in GitHub or the agent.
8. **Reboot, observe, recover or roll back:** Preserve previous kernel boot entry. Auto-start noVNC, desktop, nginx, RustDesk, remote-device daemon and Redroid; verify actual external reachability and APK input. Restore the previous kernel/old QEMU path if one service fails. Never declare `PASS` on a merely running process.
9. **Complete migration:** After a stable Redroid acceptance period, separately stop/archive the old QEMU with user-approved rollback and verify resource headroom. Do not terminate it as a prerequisite to obtaining a working replacement unless a separate temporary maintenance plan and tested fallback are approved.

## Strict release evidence contract

`scripts/cloud-android/redroid-acceptance.py` supports:

```bash
python3 scripts/cloud-android/redroid-acceptance.py live-adb --serial 127.0.0.1:5556
python3 scripts/cloud-android/redroid-acceptance.py validate-evidence --file /private/operator/acceptance.json
```

Every result identifies its transport and target version, `sha256`, independent source, `synthetic=false`, and exact test type. Missing receipts, empty hashes and simulated tests fail closed. Even a complete evidence file returns `RELEASE_ELIGIBLE_FOR_REVIEW`, **not** autonomous authorization to install a kernel or reboot. Production privileges and rollback must be reviewed separately.

**Thirteen required receipts:** Android boot, private ADB, browser screen, browser keyboard round-trip, companion screen, companion IME round-trip, semantic observation, idempotent authorized action, data persistence, reconnect, physical Termux/Android15, GitHub-hosted Android15 emulator, post-reboot Grasshopper + Kali access.

### Acceptance matrix

| Failure | State / action |
| --- | --- |
| Oracle Binder missing or unsupported symbol | BLOCKED, no Redroid launch or kernel installation |
| Insufficient RAM while old QEMU runs | BLOCKED; do not kill old guest to manufacture a PASS |
| Persistent container storage on 94%-full root filesystem | BLOCKED; stage image+data on dedicated mounted volume |
| Publicly bound ADB port | BLOCKED; require loopback-only and authenticated tunnel |
| Wrong Android version/ABI | BLOCKED; compare against explicit test lane manifest |
| Display available but text entry fails | BLOCKED; IME round-trip required, not screenshot-only |
| Agent action produces an event and replays the command | BLOCKED; idempotency and origin fence test |
| Browser works but companion app does not | BLOCKED; both transports must pass |
| Termux works on Android16 only | NOT_PROVEN for physical Android15 |
| Service unit enabled but external client cannot reconnect | BLOCKED; external smoke / rollback |
| OCI SSH/RDC expires or needs browser | HUMAN_HANDOFF, not stored credentials |
| One-off CI arm emulator passes without OCI Binder | CI_API35_PASS only; production blocked |

## Current evidence (October 13, 2026)

- Actual host: OCI Oracle Linux 9.8 aarch64, UEK 6.12; Binder device nodes **absent**. No Redroid boot verified.
- Baseline Grasshopper `grasshopper-vnc`, `grasshopper-novnc`, and `grasshopper-mcp` units **active, enabled, Restart=always**. Root volume about 94% occupied, ~60 GiB on separate data disk, approximately 3.4 GiB available RAM while existing QEMU runs.
- Both Grasshopper and Kali Remote Desktop Commander devices were reachable during read-only inspection. On Kali, VNC/RustDesk processes existed, but boot persistence **has not been established** and must be explicitly verified prior to any reboot.
- Full browser, companion, IME and Termux parity smoke receipts: **NOT_PROVEN**.
- Safe next action: finish isolated CI/kernel tests and protected remote-access recovery, **not** reboot the working server.

For the upstream feature requirements, see the redroid official documentation (deploy binderfs, private ADB, display parameters, optional WebRTC roadmap) and the Oracle UEK 8 kernel documentation. A future browser WebRTC mode is a separate implementation from the default Redroid ADB server; do not represent upstream WebRTC plans as implemented.
