# Cloud Android clean-rebuild contract

Agents rebuilding Cloud Android MUST start from a clean disposable workspace and use the last known-good implementation as the behavioral benchmark. Do not repair the current runtime in place until the clean candidate passes the legacy comparison.

Required loop:

1. Detect the active environment.
2. Record commit SHA, environment contract, CPU/RAM, KVM availability, QEMU version, noVNC/websockify availability, and current listeners.
3. Select the known-good Cloud Android lineage from Git history. Prefer salvage/cloud-android-agentic-device-20261005 when available; otherwise use the most recent validated lineage recorded by repository evidence.
4. Build the VM, screen transport, ADB transport, and input path in a disposable state directory.
5. Compare boot, screen acquisition, input injection, ADB identity, reconnect, and persistence behavior against the benchmark.
6. If a regression appears, preserve the failing artifact and fix the candidate, not the benchmark.
7. Do not declare PASS from process liveness alone. A screen artifact plus an input acknowledgement and device identity are required.
8. Only after the clean candidate passes may an agent prepare a deployment adapter or replace a compatibility wrapper.

Resource rule: Cloud Android must pass host capacity admission before launch. A 4 GiB host is not an unlimited concurrency target. Never create duplicate QEMU workers to compensate for a failed control path.
