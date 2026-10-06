# Resource Recovery Evidence 2026-10-06

## Cloud Android host

- Host: `ip-172-31-8-59`
- Resource state before recovery: root filesystem 96% used, 3.1 GB available.
- Memory: 3.7 GiB total, 1.1 GiB available.
- Inodes: 16% used.
- Primary disposable growth:
  - `/root/.npm`: approximately 3.1 GB.
  - `/var/log`: approximately 564 MB.
  - `/root/.cloud-android/inspect-system/system.img`: approximately 2.5 GB.
  - `/root/.cloud-android/tcg-test/data-copy.img`: 3 GB.
- Preserved:
  - `/root/.cloud-android/data.img`, the active persistent Cloud Android disk.
  - `/root/.cloud-android/backups/data.img.pre-adbd-20261005`, the dated restore point.
  - Runtime ramdisk, ISO, source, logs needed for active debugging, and evidence.
- Recovery actions:
  - cleaned npm cache and apt cache;
  - vacuumed archived system journal data older than 7 days;
  - removed temporary screenshot/debug artifacts under `/tmp`;
  - removed unreferenced extracted `inspect-system/system.img`;
  - removed unreferenced TCG test copy `tcg-test/data-copy.img`.
- Resource state after recovery: root filesystem 89% used, 8.5 GB available.
- Live service state after recovery:
  - QEMU running;
  - websockify running;
  - ADB bound through host loopback only;
  - `adb get-state` = `device`.

## Interpretation

This is recorded as a successful development resource-pressure recovery. No production resources were mutated. The remaining 89% root usage is below the immediate recovery threshold used for this development host, but remains a watch item because the host has a relatively small root filesystem.

## Follow-up

The recurring resource watch should alert/recover if root usage approaches the pressure threshold again. The likely recurring source to investigate is disposable build/package cache accumulation, not the persistent Cloud Android disk.
