# OCI Android QEMU — Controlled Reclamation Results

**Date:** 2026-10-13
**Scope:** Existing nonworking/stale QEMU experiment copies only; actively running Android guest, Kali, desktop services, RustDesk, networking, and container storage were excluded.

## Completed operations and measurements

Verified inactive experiment directories had **zero observed file descriptor references and zero process mount references** before retirement. For each directory, original small source/scripts/tests and an original file metadata manifest were archived **privately on the attached OCI data volume**, with restricted filesystem permissions. The private archives were verified by reopening them; original disk images and account-bearing VM storage were **never uploaded to GitHub**.

After a pre-removal gate that checked the active QEMU PID, the old Android host-forward socket and both local browser/noVNC HTTP 200 responses, the candidate directory was renamed on the same filesystem. Health was rechecked, then only the renamed inactive directory was deleted. Health was rechecked again.

| Inactive directory | Private source files archived | Original manifest entries | Measured space reclaimed |
| --- | ---: | ---: | ---: |
| `arm64-live-test-fresh2` | 3 | 15 | 3,454,570,496 bytes |
| `arm64-live-test-fresh` | 3 | 15 | 4,222,803,968 bytes |
| `arm64-live-test` | 522 | 1,263 | 21,344,559,104 bytes |
| **Total** | **528** | **1,293** | **29,021,933,568 bytes (approximately 27.03 GiB)** |

After cleanup: attached persistent filesystem free capacity **64,267,816,960 bytes**, about **59.85 GiB**.

## Protected workloads: post-operation observations

- Active QEMU guest process remained present throughout; its loopback ADB-forward port `16555` accepted TCP connections after each targeted deletion.
- Local `http://127.0.0.1/vnc.html` and `http://127.0.0.1:6080/vnc.html` returned HTTP 200 before and after each deletion.
- No running QEMU container, current `arm64-native-20261008/live-direct` data, Kali container, RustDesk configuration, nginx 80/443 or production desktop service was deleted, restarted or intentionally modified.
- Private source archives/metadata are under `/srv/grasshopper/backups/qemu-retirement-20261013`; archive names contain only neutral engineering candidate labels, **never copy these private archives into public version control**.

These checks are **transport/service continuity**, not human-visible end-to-end proof of an Android home screen or live RustDesk operation. Post-change human visual acceptance and persistent reboot proof remain open.

## Remaining work

- Do not remove the active QEMU Android guest yet: an ADB protocol `CNXN` handshake succeeded before cleanup, and no Redroid replacement is accepted.
- Audit other abandoned experimental directories independently; only retire individually confirmed unused copies and retain private source/metadata.
- Root filesystem remains congested: rootless Podman image layers are not on attached data storage. No broad Podman/Docker prune is authorized.
- Redroid requires Binder character devices and matching Oracle UEK kernel-module support; those are not yet available. Rootful container boundary/SELinux requires explicit admission.
- Operator and autonomous agents must read source only from `main`, never raw Git SHA refs, and must prevent personal information and secrets in public commits.
