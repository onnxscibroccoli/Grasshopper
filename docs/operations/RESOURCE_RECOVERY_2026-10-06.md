# Resource Recovery Evidence 2026-10-06

## Cloud Android host

- Host: `ip-172-31-8-59`
- Earlier resource state: root filesystem 96% used, 3.1 GB available.
- Earlier memory: 3.7 GiB total, 1.1 GiB available.
- Inodes: 16% used.
- Primary disposable growth previously identified:
  - `/root/.npm`: approximately 3.1 GB.
  - `/var/log`: approximately 564 MB.
  - `/root/.cloud-android/inspect-system/system.img`: approximately 2.5 GB.
  - `/root/.cloud-android/tcg-test/data-copy.img`: 3 GB.
- Preserved:
  - `/root/.cloud-android/data.img`, the active persistent Cloud Android disk.
  - `/root/.cloud-android/backups/data.img.pre-adbd-20261005`, the dated restore point.
  - Runtime ramdisk, ISO, source, logs needed for active debugging, and evidence.
- Earlier recovery actions:
  - cleaned npm cache and apt cache;
  - vacuumed archived system journal data older than 7 days;
  - removed temporary screenshot/debug artifacts under `/tmp`;
  - removed unreferenced extracted `inspect-system/system.img`;
  - removed unreferenced TCG test copy `tcg-test/data-copy.img`.
- Earlier resource state after recovery: root filesystem 89% used, 8.5 GB available.

## Follow-up recovery: 2026-10-06

A subsequent resource watch found the host at 89% root usage with only 8.5 GB available and 1.9/2.0 GiB swap used. The active QEMU/ADB/VNC stack remained healthy.

Before cleanup, Docker reported:
- 7 inactive images, approximately 7.065 GB, 100% reclaimable.
- Docker build cache approximately 6.045 GB, reclaimable.
- `/root/.cache`: approximately 260 MB.
- `/tmp`: approximately 2.7 MB.
- `/var/cache`: approximately 11 MB.
- `/var/log`: approximately 59 MB.

Recovery actions:
- pruned unused Docker images only; no containers or volumes were active;
- pruned the unused Docker builder cache;
- cleared disposable `/root/.cache` and `/tmp` contents;
- did not delete source, active Cloud Android data, restore points, evidence, or databases.

Result:
- root filesystem improved from 89% to 80% used;
- available root space improved from 8.5 GB to 16 GB;
- Docker images: 0;
- Docker build cache: 0;
- memory remained available at approximately 1.3 GiB;
- swap remained heavily utilized at approximately 1.9/2.0 GiB, so memory pressure remains a watch item;
- Cloud Android QEMU and ADB were not intentionally stopped or modified by the cleanup.

## Interpretation

These are development resource-pressure recoveries. No production resources were mutated. Persistent Cloud Android state and restore points were preserved.

The host is now below the immediate disk-pressure threshold, but the 3.7 GiB RAM / 2 GiB swap configuration means concurrent builds or additional Android workloads can still create memory pressure. The next safe capacity improvement is persistent storage or workload scheduling, not deletion of working artifacts.

## Follow-up

The recurring resource watch should alert/recover when root usage approaches the pressure threshold again. Disposable container images/build cache are a recurring source and are safe recovery targets when inactive. Persistent Cloud Android disk and evidence remain protected.
