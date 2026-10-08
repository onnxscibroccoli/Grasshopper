# ARM64 live control observation — 2026-10-08

Contract: OCI-ARM64-ADB-20261008-01. This bounded diagnostic contract completed its observations; Android control acceptance failed its gate. R2 remains NOT_PROVEN.

## Source, identity and preservation

Source baseline: PR #168, `85fe2c74841dff50fd1e6a30ecd1486876add471`. This source reference is not proof that every live guest artifact was built from that commit. RDC node `0852e6f4-2507-4d0f-9d62-f6eda8cdd169` was verified as grasshopper-workstation, aarch64, OCI VM.Standard.A1.Flex before diagnostic execution.

At 2026-10-08 05:49:26 UTC the original QEMU PID 1123620, started 01:37:50 UTC, remained running. No guest restart, disk reset, input injection, access-policy change, or deployment was performed. Other guest containers were observed but not modified. Cloud chat, guest disks and existing dirty source work were preserved.

## Resource envelope, lease and recovery

Live original: 2 vCPU, 2048 MiB guest RAM, TCG multi, virtio-gpu, CPU max with pauth-impdef=on. Observed QEMU RSS 1,948,260 KiB and lifetime CPU 59%; these are a snapshot and cumulative percentage, not a sampled interval utilization test.

Diagnostic ADB clients used the existing local runtime image, transient containers with 128 MiB memory, and individual 5–8 second command timeouts. An initial attempt with a 0.25 CPU quota failed because the CPU controller was unavailable; the bounded retry omitted that unsupported quota. Client servers were stopped and transient containers removed. No persistent diagnostic worker or resource lease was created. The observation lease ended with client cleanup. Future clients should use a dedicated ADB server port to avoid interference with concurrent work. Recovery means stop only the diagnostic client; do not stop the original guest.

## Acceptance observations

- ADB endpoint 127.0.0.1:16555: connect succeeded and get-state returned device.
- ADB features were returned, including shell_v2.
- getprop sys.boot_completed and shell true both returned error: closed.
- A bounded logcat request waited for device and timed out; no successful logcat collection is claimed.
- VNC 127.0.0.1:5906 capture showed a 1280x800 LineageOS Welcome screen and “Setup Wizard isn't responding” dialog.
- Keyboard, pointer, browser reconnect and physical-phone/cloud control were not tested because the boot/shell gate remained unmet.

The framebuffer artifact is retained on OCI at `/srv/grasshopper/android/development/arm64-observation-20261008/direct-0548.png`.
SHA-256: `2ed8bfb826576a1351d07ccada416a2eb0a299d0d6bcbffc8cab1c5c10e5c1d3`.

Serial diagnostics show system_server activity around guest seconds 4875–5183, adbd stop/start around 5048–5049, and a denied mdnsd service request under adbd_tradeinmode at 5052. This is a lead for shell restriction diagnosis, not proof of the sole cause. Do not disable SELinux or authentication to make a test pass. Later serial output contains system_suspend sysfs denials; boot completion was not established.

## Integration and next contract

PR #168 was open, draft, unmerged and reported non-mergeable at observation time. The workflow lookup returned no PR-triggered runs for its exact head; full CI acceptance remains unverified. No release tag, merge or deployment occurred.

Next contract: inspect supported adbd/trade-in-mode behavior and Setup Wizard ANR evidence without restarting QEMU; correlate fresh CPU, process and serial evidence before network changes. Once an authenticated shell and sys.boot_completed=1 are freshly proven, capture before/after frames and prove a harmless HOME/input result and reconnect on the same guest and transport.

The separate [integration map](OCI_ARM64_CONTROL_INTEGRATION_MAP.json) records only this observation. The older OCI_TCG_INTEGRATION_MAP.json is absent at the PR #168 baseline and was not fabricated or copied from another branch. Validation for this documentation-only change checks JSON parsing, state assertions, source reference and links; it is not an Android test-suite pass.
