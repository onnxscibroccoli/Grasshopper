# Observed remote desktop reference profile

Captured 2026-09-28 UTC from the authorized Helix/Kali host. This is a reference contract, not a secret-bearing configuration dump.

## L1 AWS host

- AWS region: `us-east-1`
- EC2 family: `c7i-flex.large`
- nested virtualization: enabled
- public entry: CloudFront -> EC2 HTTP origin
- SSH is not the browser access path
- SSM is available for agentic host lifecycle
- host services use systemd
- VNC/noVNC remain localhost-only

AWS currently documents C7i-flex as supporting nested virtualization and documents the launch-time `NestedVirtualization=enabled` CPU option.

## L2 persistent workspace

Observed libvirt domain:

- domain: `helix-omnikali`
- persistent: yes
- autostart: enabled
- CPU: 2 vCPU
- memory: 2 GiB
- CPU mode: host-passthrough
- network: libvirt `default`
- guest display: VNC bound to `127.0.0.1`
- guest agent: virtio channel `org.qemu.guest_agent.0`
- persistent disk: qcow2 overlay at `/var/lib/helix/ebs/omnikali/disk.qcow2`
- base image: `/var/lib/helix/disks/kali-rolling-base.qcow2`
- base image observed size: 16 GiB logical file
- persistent overlay observed size: approximately 8.8 GiB at capture time

Guest OS reported through QEMU Guest Agent:

- Kali GNU/Linux
- Kali Rolling
- version-id `2026.3`
- x86_64
- kernel `7.1.5+kali-amd64`

## Desktop

The guest image contains the graphical desktop path. The reference acceptance requires:

- Xfce
- Firefox
- terminal
- QEMU guest agent
- persistent user workspace
- reconnect without destroying the workspace

The host also contains legacy/local desktop bridge units. The primary public browser path must remain the authenticated Helix gateway -> workspace VNC stream. Host-local VNC/noVNC must never become a public bypass.

## Public browser path

```
Browser
  -> HTTPS CloudFront
  -> EC2/Nginx
  -> authenticated Helix gateway
  -> owner-scoped workspace
  -> short-lived desktop ticket
  -> WSS /kasm/ws/omnikali
  -> localhost VNC
  -> persistent Kali guest
```

The gateway creates an HttpOnly Secure session after OIDC and issues a short-lived workspace-scoped desktop ticket. OIDC credentials are not part of the desktop stream.

## Reconstruction consequence

The source-controlled rebuild must reproduce these observable properties. It does not need to reproduce incidental host identifiers, UUIDs, IP addresses, or timestamps.

The existing local base image file is **not** an acceptable deployment prerequisite. It must be replaced by a deterministic, integrity-verified image acquisition/build step.
