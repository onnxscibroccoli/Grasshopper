# 2026-10-06/07 OmniKali host OOM incident

The Helix EC2 KVM host exhausted 3.7 GiB RAM plus 2 GiB swap while running persistent Kali and three Cloud Android QEMU workers. Kernel OOM records show repeated termination of QEMU, including `helix-omnikali`, producing the observed Kali availability/restart loop.

Recovery:
- Preserved primary `omnikali-cloud-android`.
- Terminated duplicate `omnikali-adb-control` and `omnikali-adb-e1000` workers.
- Started libvirt domain `helix-omnikali`.
- Confirmed SSM and the host remained available.
- Installed a 30-second host memory guard that removes only those known duplicate Android workers under memory pressure.

Architectural conclusion:
The 4 GiB c7i-flex.large host is undersized for unrestricted concurrent Kali + multiple Android QEMU workloads. Cloud Android launch must become resource-aware. The durable capacity target is at least 8 GiB, with the resize scheduled as planned maintenance because EC2 type changes require a stop/start.

See the authoritative Helix incident and guard implementation:
- `helix/docs/incidents/2026-10-06-kali-oom-recovery.md`
- `helix/ops/omnikali-memory-guard.sh`
