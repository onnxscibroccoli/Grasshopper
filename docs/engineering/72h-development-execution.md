# 72-Hour Development Execution Model

Status: ACTIVE
Mode: DEVELOPMENT_EXECUTION
Window: rolling 72 hours from activation

## Operating posture

Development execution is intentionally permissive across authorized execution surfaces.

Agents may use broad shell access on nodes already authorized through RDC, SSH, containers, CI runners, or equivalent control-plane surfaces. Development tooling must not add artificial command allowlists that prevent infrastructure diagnosis, provisioning, benchmarking, recovery, or automation.

This is not a public unauthenticated shell policy. Existing host/network authorization boundaries remain intact.

Production is a separate promotion boundary. Production deploys remain fail-closed with authentication, authorization, auditability, replay-safe request identity, explicit capability scopes, and deterministic acceptance gates.

## Contract loop

Every autonomous work item follows:

1. DISCOVER: inspect current node/provider/resource state.
2. PLAN: select the smallest reversible implementation.
3. EXECUTE: use the authorized development execution surface.
4. VERIFY: collect direct evidence, not inferred state.
5. RECORD: persist status, resource telemetry, artifacts, and provenance.
6. RECOVER: if a resource limit or service failure occurs, reclaim capacity and restore the last known-good execution surface.
7. PROMOTE: only production work enters the fail-closed acceptance boundary.

A claim is PASS only when its contract evidence is present.

## 72-hour foundation milestones

### M1. R2 Cloud Android ADB
- Complete guest/network diagnosis.
- Establish adb connect.
- Require adb get-state=device.
- Require adb shell id.
- Require stable guest artifact such as getprop ro.kernel.qemu.
- Preserve VNC/RFB input and display.
- Record exact image, kernel, ramdisk, QEMU, and platform-tools versions.

### M2. Persistent execution substrate
- Verify /srv/grasshopper persistent capacity.
- Keep active build/cache/artifact paths on persistent storage.
- Detect disk, inode, memory, CPU, process, and file-descriptor pressure.
- Automatically reclaim only disposable caches/logs/build outputs.
- Never delete source, evidence, databases, or declared restore points during recovery.

### M3. Local AI runtimes
- Benchmark ARM64 llama.cpp and/or Ollama.
- Record model load time, first-token latency, tokens/sec, memory, CPU, OOM behavior, and recovery.
- Add local inference as a node capability.
- Keep model artifacts separate from source and evidence.

### M4. Provider-neutral cloud adapters
- Define a common provider contract for AWS, OCI, Azure, and IBM Cloud.
- Implement discovery, provisioning, execution, logs, teardown, and resource telemetry.
- Prefer Terraform/OpenTofu plus provider-neutral contracts.
- Keep provider-specific logic inside adapters.

### M5. Container-first execution
- Build OCI-compatible development images.
- Provide Compose-compatible local integration.
- Add Kubernetes-compatible manifests/contracts where justified.
- Standardize health, readiness, capability manifest, version, architecture, graceful shutdown, and evidence output.

### M6. Agentic MCP execution grid
- Keep local stdio and authorized node execution working first.
- Add development shell execution without artificial command restrictions.
- Every execution request gets correlation identity and an evidence record.
- Production MCP remains fail-closed.

### M7. Quantum provider abstraction
- Add a provider-neutral asynchronous quantum job contract.
- IBM Quantum/Qiskit adapter.
- Rigetti/QCS adapter.
- Simulator-backed BIST before hardware execution.
- Persist job metadata, result artifacts, provider identity, version, and checksum.

## Resource telemetry contract

Every managed node should report:

- CPU utilization/load
- memory used/free
- filesystem capacity and inode usage
- process count
- open file descriptors when available
- container count/resource usage when applicable
- GPU/NPU utilization when available
- network listener/connection health
- service/process health
- last recovery action
- current execution workload

Resource thresholds are adaptive to node capacity. A threshold breach creates RESOURCE_PRESSURE, not a false service failure.

## Recovery policy

Recovery is automatic for development nodes when safe:

1. stop or cancel the heaviest disposable workload;
2. reclaim package/build/model caches;
3. rotate or compress disposable logs;
4. restart the affected development service;
5. re-run readiness and BIST;
6. resume the interrupted contract from its checkpoint;
7. preserve the evidence trail.

If pressure persists after reversible recovery, quarantine the workload and mark the node RESOURCE_CONSTRAINED. Do not repeatedly restart a failing service.

Production recovery follows the existing fail-closed operational policy.

## Evidence states

PASS = direct live evidence satisfies the contract.

PASS_WITH_NOT_PROVEN = some live components work but the complete contract is incomplete.

NOT_PROVEN = required evidence is absent.

FAIL = a required assertion was directly disproven.

RESOURCE_PRESSURE = execution was constrained by capacity; this is orthogonal to functional PASS/FAIL.

## Priority order

1. Preserve working execution surfaces.
2. Complete R2 ADB.
3. Establish resource telemetry/recovery.
4. Provision persistent container-first development substrate.
5. Benchmark local AI runtimes.
6. Implement AWS/OCI/Azure/IBM provider adapters.
7. Expand MCP development execution.
8. Add IBM Quantum and Rigetti asynchronous job adapters.
9. Re-run BIST and live acceptance after each material change.

## Non-goals during development

Do not spend the 72-hour foundation window prematurely hardening production policy into development tooling.

Do not expose an unauthenticated Internet-facing shell.

Do not replace a working transport merely because a newer architecture is preferred.

Do not call a milestone complete without direct evidence.
