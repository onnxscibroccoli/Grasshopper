# OCI-TCG-CPU-20261008-01

Bounded diagnosis and source contract for the OCI Android worker. This is not
R2 acceptance and does not authorize production deployment.

## Identity and envelope

- Repository baseline: `fdbd7f244be8094571f8a9426b8c2ccd9b01b259`.
- Live launcher SHA-256: `75adf480ce8cc061fed1c6001c12a6073968ee65691895580c99cf96ed86fa11`.
- Runtime image digest: `sha256:6baa90c8ad527c166d79272d89f090a74f321274270f1e85bb10f7d6ab930849`.
- Node: verified OCI `VM.Standard.A1.Flex`, AArch64, reached through the
  authorized RDC device `0852e6f4-2507-4d0f-9d62-f6eda8cdd169`.
- Experiment: isolated state `lean1024-known-good-data-20261008`, restored
  from the legacy known-good data image; 1 vCPU, 1024 MiB guest RAM, TCG
  single-thread, loopback ports 15916/16086/15559.
- Lease: ten minutes from guest start at 2026-10-08T00:44:45Z. No paid
  capacity, background agent, access-control change, or production mutation.
- Recovery: stop only `grasshopper-android-lean1024-known-good` and retain its
  isolated state/evidence. The original guest disk and working cloud chat were
  not mounted by this experiment.

## Fresh findings

Host admission passed with 8069 MiB available and 2383 MiB swap free. Kernel,
user-slice, and container cgroup evidence recorded zero OOM kills and no memory
limit. Earlier containers with exit 137 also report `OOMKilled=false`; exit 137
must not be described as an OOM without additional evidence.

The isolated guest saturated one host CPU throughout the observed boot. QEMU
RSS grew from 553 MiB at guest age 39 seconds to 1759 MiB at 207 seconds, then
1852 MiB at 356 seconds. At guest uptime 342 seconds, `sys.boot_completed` was
still empty, `service.bootanim.exit=0`, and boot animation and SurfaceFlinger
services were running. Guest `top` attributed 44.7% to `bootanimation`, 20.9%
to `system_server`, 8.5% to `zygote64`, and 6.1% to the loop device. This fresh
run does not reproduce the earlier 173% SurfaceFlinger sample; it instead
isolates sustained boot/render work under cross-architecture TCG.

RFB capture moved from SeaBIOS text through a black framebuffer to the Android
boot logo at QEMU age 615 seconds, but never showed an interactive Android UI.
The final serial request did not return properties within its 14-second bound;
the last responsive property check therefore remains the 342-second sample.
The canonical kernel arguments
include `nomodeset HWACCEL=0`, so an authenticated A/B with modesetting is the
next rendering-boundary test. A prior attempt to remove `nomodeset` exited
before QEMU because it copied the launcher without its sibling admission
checker; that attempt contains no graphics result and must not be counted.

## Source change and checks

`CLOUD_ANDROID_GRAPHICS_MODE` now has two validated values:

- `compatibility` is the unchanged default and emits `nomodeset HWACCEL=0`;
- `modeset` emits `HWACCEL=0` for an isolated experiment.

Invalid values fail closed. The canonical script exposes `graphics-args` so a
contract can verify selection without launching a guest, and `start` consumes
the same validated result. This removes the need to copy or patch the launcher
inside a container. It does not claim that modesetting works.

The focused test was written first and failed with exit 64 because the command
did not exist. It passed after the minimal implementation. The final focused
run passed 6/6, the full suite passed 241/241, `bash -n`, the degradation guard,
and `git diff --check` passed. Exact-commit GitHub CI remains required.

## Acceptance and next action

PASS: node identity, source/image identity, absence of OOM, persistent CPU
pressure, incomplete boot phase, and black RFB boundary are bound to one fresh
isolated run. PASS: a test-covered, fail-closed graphics selector is available.

NOT PROVEN: boot completion, authenticated ADB on this guest, visible Android
UI, keyboard/pointer, browser reconnect, phone-to-cloud control, and R2.

The canonical transport stop completed. The container's inert `tail` process
did not exit on SIGTERM and Podman used SIGKILL after ten seconds; container
exit 137 again records `OOMKilled=false`. The 2.0 GiB isolated state and its
evidence were retained, while its ports and processes were stopped.

Next contract: use a separate copy of the same
known-good data and the canonical launcher with
`CLOUD_ANDROID_GRAPHICS_MODE=modeset`. Compare boot properties, guest top, RFB
hash/image, and host CPU at fixed times. Do not restart the current guest merely
to probe ADB and do not reuse historical ADB evidence as a result.
