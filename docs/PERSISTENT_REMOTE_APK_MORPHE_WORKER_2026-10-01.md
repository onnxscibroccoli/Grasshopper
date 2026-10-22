# Persistent Remote APK and Morphe Worker 2026-10-01

## Purpose

Move resource-heavy APK inspection and patch/build work off the Android device while keeping Android as the UI and execution edge.

## Current worker inventory

### Oracle

- RDC label: `grasshopper-workstation`
- RDC ID: `0852e6f4-2507-4d0f-9d62-f6eda8cdd169`
- Oracle Linux Server 9.8
- arm64
- 2 CPU
- 10 GiB RAM
- 30 GiB root, approximately 26 GiB used
- approximately 4 GiB free
- Podman present
- Java currently absent

This host is suitable for control-plane/orchestration, but its current disk headroom is too small for an unbounded APK build cache. Do not fill it opportunistically.

### AWS

- RDC label: `ip-172-31-8-59`
- RDC ID: `882f1036-235b-4669-acaf-1e1135b156bd`
- EC2 instance: `i-03b6a82d46271d9cd`
- instance type: `c7i-flex.large`
- Debian 13
- x86-64
- 2 CPU visible to worker
- approximately 3.7 GiB RAM
- approximately 14 GiB free on root
- Docker present
- Java currently absent

This host currently has more disk headroom than Oracle but less available memory. A bounded containerized worker is the safer first experiment.

## Worker contract

Input:

- original APK bytes
- SHA-256
- package/version metadata
- patch source identity and version
- requested patch selection
- target architecture constraints

Output:

- patched APK
- output SHA-256
- signing identity/fingerprint
- toolchain versions
- patch source metadata
- build log
- resource/memory metrics
- deterministic evidence record

Never overwrite the original APK.

## Tool selection

Prefer Morphe Patcher-native bytecode/raw-resource patch paths when the selected patch does not require decoded Android resources.

Use APKTool decode/build only when the patch actually needs resource decoding/rebuilding. This reduces CPU, RAM, and I/O cost.

APKTool jobs must be explicitly bounded. Its current CLI supports a jobs setting and defaults to multiple workers, so the worker should not blindly use host CPU concurrency.

## Persistence

The worker should use:

- a pinned container image or reproducible host toolchain
- durable artifact storage
- bounded work directories
- cache eviction
- job IDs
- immutable input/output hashes
- signed artifact metadata
- resumable checkpoints
- no secrets in build directories

## Security

APK inputs are untrusted. Build workers must be isolated from control-plane secrets and production credentials. Private signing keys should remain outside the general-purpose patch worker unless an explicit signing service is introduced.

## Evidence

- remote worker architecture: DESIGN
- Morphe patcher library supports modular bytecode/resource/raw APK patches: DOCUMENTED
- APKTool remote execution: NOT_PROVEN
- reproducible remote patched artifact: NOT_PROVEN
- persistent worker deployment: NOT_PROVEN
