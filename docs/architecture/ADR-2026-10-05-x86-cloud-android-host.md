# ADR: x86 execution host for persistent Cloud Android

- Date: 2026-10-05
- Status: Proposed, pending OCI capacity and migration verification
- Scope: Cloud Android execution substrate, not the existing OCI workstation's host input configuration

## Context

The current OCI workstation is AArch64. The existing Grasshopper persistent Android guest implementation expects an x86_64 QEMU guest and a usable `/dev/kvm`. The workstation has no `/dev/kvm` and no `qemu-system-x86_64`, so running that guest there is not a valid production deployment.

The existing Grasshopper host implementation and the AWS x86 Android worker are prior art and should be reused rather than replacing the guest lifecycle, disk layout, or viewer from scratch.

## Decision under evaluation

Evaluate an x86_64 OCI compute instance as the Cloud Android execution host. Do not attempt an in-place ARM-to-x86 architecture flip on the current OCI instance. Treat this as a parallel replacement/migration: provision a separate x86_64 instance, prove its virtualization capabilities and capacity, migrate/reuse the existing Android image and lifecycle scripts, verify persistence and input, then switch the viewer route only after acceptance passes.

Keep the existing ARM OCI workstation intact as an administration/control node until the replacement passes. If OCI quota, shape availability, nested virtualization, or cost makes this unsuitable, retain the proven AWS x86 Android worker as the execution host and keep OCI as control plane.

## Required preflight evidence

- OCI region and availability domain support an x86_64 shape with enough CPU, RAM, boot/block volume capacity, and network quota.
- The selected shape exposes usable KVM/nested virtualization for the intended QEMU guest. CPU architecture alone does not prove nested virtualization.
- Existing OCI boot and data volumes, source repositories, credentials, and viewer/tunnel configuration are inventoried and recoverable.
- A separate x86 instance can be provisioned without stopping, resizing, or reconfiguring the current ARM workstation.
- The current Android image and lifecycle scripts are identified from the repository's passing history before any migration or rebuild.

## Production acceptance gates

1. QEMU x86_64 starts the persistent Android guest with KVM acceleration; no silent software-emulation fallback.
2. Android VNC/RFB and ADB endpoints are reachable only through intended authenticated network paths.
3. Browser viewer connects to the Android guest, not the OCI host desktop.
4. Physical-device touch and native keyboard input reach the guest and change its framebuffer.
5. Home, Back, Recents, reconnect, and app relaunch work without losing Android user data.
6. Broccoli Core uses only individually verified working transport/control components and controls the same guest.
7. Health evidence distinguishes PASS, FAIL, NOT_PROVEN, and NOT_APPLICABLE. Diagnostic controls are absent from the normal viewer and available only through a separate health endpoint or explicit diagnostic flag.
8. OCI administration access and AWS/Helix production services remain healthy throughout migration.

## Safety constraints

- Do not alter Debian host keyboard/XKB/input settings to fix Android guest input.
- Do not delete or repurpose the current OCI workstation or its volumes as part of the experiment.
- Do not publish a viewer URL as working until the end-to-end Android framebuffer and input tests pass.
- Do not claim the OCI x86 option is feasible until shape availability, quota, and KVM capability are checked in the actual tenancy.

## Current evidence

- Existing OCI workstation architecture: AArch64.
- Existing OCI workstation: `/dev/kvm` absent; `qemu-system-x86_64` absent.
- Existing AWS Android worker: x86_64, `/dev/kvm` present, `qemu-system-x86_64`, `websockify`, `adb`, and noVNC installed.
- AWS worker is a viable fallback execution host; this does not yet prove that the Android guest itself is running or that physical keyboard/touch input passes end to end.

## Next steps

1. Inspect OCI tenancy/region, x86 shape availability, quotas, and virtualization capabilities without modifying the existing instance.
2. Compare a parallel OCI x86 worker against the existing AWS worker on reliability, storage, cost, and route complexity.
3. Reuse the existing persistent Android image and lifecycle scripts; add only the smallest host-specific adapter required.
4. Run the acceptance gates and record concrete command output/screenshots before promoting the viewer.
