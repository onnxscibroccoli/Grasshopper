# OCI Android QEMU — Verified Triage and Controlled Retirement

**Date:** 2026-10-13 | **State:** Partially operational QEMU, active; obsolete experiment directory inventory measured, selective cleanup not yet verified.
**Scope:** OCI Oracle Linux 9.8 ARM64 host, 2 OCPU/12 GiB, existing persistent attached data volume. No host reboot, network edits, Kali service restart or credential exposure authorized.

## Verified evidence

- Live host kernel: `6.12.0-206.104.4.4.el9uek.aarch64`; not the Ubuntu/kernel described in older Redroid planning.
- Android-specific QEMU process: `qemu-system-aarch64`, in a container supervised by `conmon`. It was **not a Kali guest**. `/state` maps to `/srv/grasshopper/android/development/arm64-native-20261008/live-direct`; protect this directory and its container storage.
- QEMU had been running about 5 days, consumed approximately 2.8 GiB resident memory, and used a substantial fraction of one host core. No KVM was configured for that process.
- An **Android ADB forward** was configured at local port `16555 -> guest 5555`. A read-only transport-level ADB handshake succeeded with a well-formed `CNXN` reply. This proves ADB protocol reachability but **does not** establish `sys.boot_completed=1`, app installation, interactive screen acceptance or persistence. **Do not describe this guest as a wholly failed build, and do not delete its active files until independently replaced or operator explicitly overrides.**
- QEMU's VNC listening port `127.0.0.1:5906` was present. Existing `127.0.0.1:5901,5903,5904` and local browser/noVNC routes continued responding. HTTP `/vnc.html` on port 80 and local `6080/vnc.html` returned 200; `/health` on that host returned 404, so it is not a verified health gate.
- Persistent attached filesystem `/srv/grasshopper` measured ~112 GiB total, ~78 GiB used, ~33 GiB free. Root filesystem measured ~94% full.
- `/srv/grasshopper/android/development` contained approximately **64 GiB** in QEMU/development experiments. Significant footprints included `arm64-live-test` (~20 GiB), `arm64-native-20261008` (~9.5 GiB, **active: protect**), `arm64-lineage-20261008` (~6.6 GiB), two `arm64-live-test-fresh*` (~4/3.3 GiB), and `arm64-native-lead-20261008` (~4.1 GiB). Sizes are approximate, not exclusive proof of safe deletion.
- `podman ps` in the rootless user scope alone did not enumerate the QEMU container even though `conmon` supervised it. Do not infer guest absence solely from that list.
- Redroid is **not deployed**. Binder character devices missing; kernel-devel absent; existing rootless Podman overlay storage is on root disk, not the data volume. UEK kernel support is unproven. The `androidboot.use_memfd=1` option does not eliminate Binder requirements.

## Learning and architectural decision

QEMU ARM64 TCG is a valid fallback but costly in CPU/RAM and data footprint on the constrained free OCI A1 node. Replace it only if a Redroid container passes actual Binder/boot/input/persistence tests on **Oracle UEK 6.12**, with working and independently verified remote desktop access preserved. Host networking, public nginx 80/443, Kali, RustDesk, Cloudflare/websocket viewers, and remote recovery are outside the cleanup scope.

The legacy experiments' names, footprints and symptom history are sufficient public documentation. Raw disk images, app data, browser profiles, passwords and account session files must **not** be pushed to the public trash repository or GitHub. Archive unique local test scripts/logs **privately** and sanitize only engineering conclusions for Git.

## Retirement and reclamation gates

1. Confirm working guest container identity, filesystem bind mount, ADB/home-screen acceptance, and recovery route. Protect every open fd, mounted path, running container layer and referenced guest image.
2. Capture a redacted manifest: candidate path label, byte count, extension/type counts, running-process/mountpoint overlap and observed tests, without usernames, secrets, network tokens or unique identifiers.
3. For each abandoned experiment, preserve unique non-secret source/tests and meaningful failure analysis. Use a private permissions-restricted archive on `/srv/grasshopper` for uncertain original artifacts. Never publish that archive.
4. Before deletion, check all hosts' access paths and snapshot status; retire **one** verified inactive experiment at a time. Never `rm -rf /srv/grasshopper/android`, `docker system prune -af`, or remove running container storage.
5. Verify disk headroom, ADB of protected guest and remote desktop listeners **after each** targeted deletion. Record exact byte savings, not estimated sum of sparse virtual disk sizes.
6. Once Redroid is proven, explicitly migrate required sessions/files with operator consent and then retire the active QEMU Android. Keep Kali and recovery independent throughout.

## Verification still open

- Actual Android boot property and usable home screen on active QEMU guest: **not proven**.
- Whether each inactive candidate contains important private account state: **not proven**.
- Safe selective deletion and measured disk recovery: **pending**.
- Redroid kernel support, successful container boot and data persistence: **blocked on Binder/permissions/storage**.
