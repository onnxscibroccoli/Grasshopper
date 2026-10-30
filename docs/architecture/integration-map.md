# OmniKali Integration Map

Status: active development architecture
Purpose: provider-neutral integration map for Grasshopper, OmniKali, Helix, Broccoli Core, cloud compute, Android nodes, local AI, and quantum backends.

## Core control boundary

Grasshopper is the reference control plane, domain-contract boundary, reconstruction framework, evidence ledger, and deployment coordinator.

```
AI / Agent Clients
        |
        v
Grasshopper Control Plane
        |
        +-- Node Registry / Capability Contracts
        +-- MCP / Agent Gateway
        +-- BIST / Readiness / Evidence
        +-- Artifact + Provenance Store
        +-- Recovery / Lease / Job State
        |
        +----------------+----------------+----------------+
        |                |                |                |
      Helix          Kali Node       Broccoli Core    Cloud Nodes
   production       persistent       Android/Termux    AWS/OCI/Azure/IBM
   desktop VM       workstation       automation
        |                |                |
    libvirt/QEMU       GUI/VNC         Rish/Shizuku
    PostgreSQL         browser         physical device
        |
   Cloud Android
   QEMU guest
   VNC/RFB
   ADB transport
```

## Node integration contract

Every execution node should expose the same conceptual contract:

- identity and lifecycle
- capability manifest
- health/readiness
- execution surface
- artifact output
- evidence status
- version/build identity
- graceful restart/recovery
- resource telemetry

The transport may differ. The contract does not.

### Current execution surfaces

| Node | Primary surface | Secondary surface | Current evidence |
| --- | --- | --- | --- |
| Kali workstation | RDC / local shell | MCP stdio | available |
| Cloud Android | VNC/RFB | ADB 5555 | R2 ADB recovery in progress |
| Physical Android | Termux/RDC | Shizuku/Rish | R3 NOT_PROVEN |
| Helix production | authenticated Helix API | libvirt/QEMU | preserve existing production path |
| AWS/OCI/Azure/IBM Cloud | container/VM executor | provider APIs | provider adapters to be built |

## Container-first deployment model

Applications and node agents are packaged as OCI-compatible containers wherever the target supports containers.

Local development:
- Docker or Podman
- Compose for multi-service integration
- bind-mounted persistent workspace/artifacts

Cloud deployment:
- Kubernetes-compatible workloads where justified
- provider-native managed container platforms where simpler
- Terraform/OpenTofu provider modules for infrastructure
- immutable image/version references for production

The deployment contract is terminal-agnostic: an agent invokes a provider adapter rather than assuming AWS, OCI, Azure, or IBM-specific commands.

## Cloud expansion

Provider adapters are planned for:

- AWS
- Oracle Cloud Infrastructure
- Microsoft Azure
- IBM Cloud

Each adapter owns credentials, resource discovery, provisioning, teardown, logs, and provider-specific capability translation. Grasshopper owns the cross-provider job and evidence contract.

## Quantum integration

Quantum systems are treated initially as asynchronous remote compute capabilities, not privileged infrastructure.

```
Agent
  |
  v
Quantum Gateway
  |
  +-- provider-neutral job contract
  |
  +-- IBM Quantum / Qiskit
  |
  +-- Rigetti / QCS
  |
  v
job result + metadata + provenance + checksum
  |
  v
Grasshopper artifact/evidence store
```

The first quantum milestone is a provider-neutral submission/result contract and a simulator-backed BIST. Hardware execution becomes a separate evidence gate.

## Local AI runtime

Local inference is another node capability:

- ARM64 Linux: llama.cpp or Ollama after hardware benchmark
- Cloud Android: guest inference only when resource budget permits; otherwise host-side inference
- Physical Android: small quantized models through an appropriate native runtime
- VLM support is a separate capability gate

Models are selected by measured latency, memory, throughput, tool-call accuracy, and recovery behavior.

## Bootstrap and reconstruction

The preferred lifecycle is:

1. discover target architecture
2. bootstrap dependencies
3. materialize configuration
4. deploy versioned container/node agent
5. run BIST
6. run readiness probes
7. run live acceptance scenarios
8. publish evidence and provenance
9. register capability
10. promote only after the required gate passes

A development bootstrap may be convenient and curl|bash compatible, but production promotion must use pinned, verifiable artifacts.

## R2 priority

R2 Cloud Android ADB is the first concrete deliverable after this map.

Required evidence:

1. QEMU guest boots from the rebuilt ramdisk.
2. adbd is actually running.
3. host ADB reaches `127.0.0.1:5555`.
4. `adb get-state` returns `device`, not `offline`.
5. `adb shell id` returns a real guest identity.
6. A stable guest artifact is collected, for example `getprop ro.kernel.qemu`.
7. The existing VNC/RFB screen plane remains intact.

Until all seven are observed live, R2 remains NOT_PROVEN/BROKEN_NEEDS_REIMPLEMENTATION as appropriate.

## Development versus production

Development may use broad shell execution through already-authorized node surfaces to accelerate diagnosis and automation.

This does not mean exposing an unauthenticated network shell or removing host access controls.

Production remains a separate fail-closed promotion boundary with authentication, authorization, auditability, replay-safe request identity, and explicit capability scopes.
