# Android worker setup — 2026-10-03
Status: implementation in progress; acceptance not yet proven.
User authorized AWS/OCI setup and autonomous execution on 2026-10-02.
## Intent and choice
Run two persistent Android 15 development environments controlled by Grasshopper.
Use a dedicated AWS m7i-flex.large (2 vCPU, 8 GiB) with explicit nested virtualization,
100 GiB encrypted gp3, IMDSv2, termination protection, SSM-only administration,
and a new security group with no inbound rules. No production host mutation.
Initial m7i.xlarge launch was rejected by the account Free Tier restriction.
AWS lists m7i-flex.large as eligible with nested virtualization. Eligibility does
not establish zero charges: credit balance, storage, IPv4 and egress still apply.
Guest allocations reduced to 2 GiB RAM and 1 vCPU each for this host.
OCI controller has no /dev/kvm and 2.8 GiB free. Existing AWS base has
KVM but only 298 MiB available RAM, so neither is a suitable dual emulator host.
## Environments and boundaries
Companion: Android 15 Google Play release image, non-root, approximate A14 screen.
Dev: Android 15 AOSP image supporting adb root. This means root shell development,
not a claim of preinstalled Magisk or permanent arbitrary system partition writes.
Separate Unix users, 0700 homes, persistent AVD disks, distinct ports and displays.
No personal credentials or phone app-private data are copied. Samsung firmware,
hardware keys and existing authenticated sessions cannot be cloned this way.
Guest egress to metadata/private networks and cross-instance control is blocked.
Both guests share a host kernel; this is development isolation, not a hostile
multi-tenant security boundary. The worker role has only SSM managed-node access.
## Access and integration
Private loopback noVNC at 6080/6081, reached through authenticated SSM forwarding.
Machine state stays independent from viewer connections. Closing a viewer does
not stop an emulator. No public endpoint is advertised from a local health probe.
Use canonical Grasshopper executor to invoke future allowed operations. Evidence
observations must never replay commands. Native companion camera/call/SMS routing
and planner/event-bus integration remain separate acceptance gates, not shipped.
## Execution plan
1. Commit bootstrap, infrastructure definition and independent verifier.
2. Create isolated AWS resources, pin deployment source SHA, install over SSM.
3. Require KVM ioctl, both boot-complete properties, expected root/non-root identities,
   fresh UI XML and PNG, distinct persistent markers after service restart.
4. Inspect listeners and firewall; verify private viewer HTTP and RFB.
5. Record failures honestly, source SHA and resource identifiers; push draft PR.
## Recovery
Systemd bounds crash retries (3 per 10 minutes). Persistent disks survive process
restart. Stop new worker via EC2 to cap compute charges; storage continues billing.
Do not terminate/delete disks to recover. Keep original bootstrap and evidence.
Before destructive guest reset, back up that guest directory with service stopped.
No claim of 14-day backups until a retention policy and restore drill pass.

