# Always-Free Agentic Deployment Contract - 2026-10-05

## Governing objective

Grasshopper/OmniKali must be able to deploy the requested stack agentically with FREE as the default cost constraint.

No provider, model API, cloud VM, GPU, or paid SaaS may become a mandatory architectural dependency when an equivalent user-owned, open-source, or genuinely free implementation can satisfy the requested capability.

This is a portability and orchestration requirement, not a promise that unlimited compute is available for free.

## User-facing contract

The user can request:
- a persistent AI workstation;
- a disposable workstation;
- a persistent or disposable Android workstation;
- a browser/desktop automation environment;
- their own model;
- their own machine-vision model;
- model refinement/training using their own data;
- an agent with local or self-hosted inference;
- a complete stack on their own machine;
- a free cloud deployment where free resources are sufficient.

The orchestrator should resolve the implementation without requiring the user to understand the underlying infrastructure.

Human interaction is reserved for actual external gates such as OAuth, CAPTCHA, device approval, or an explicit request to enter learning mode.

## Cost policy

Selection order:
1. User-owned hardware.
2. Existing genuinely free resources already available to the user.
3. Provider free-tier resources that actually satisfy the required capability.
4. Open-source/self-hosted substitutes.
5. Optional paid accelerator only after explicit user authorization.

Never silently create billable resources.

If no free path can satisfy a requested capability, report the exact capability gap and offer the user-owned or optional paid path. Do not weaken correctness merely to claim success.

## Capability model

Provider implementations should advertise machine-readable capabilities covering:
- architecture: x86_64, arm64;
- CPU capacity;
- GPU/NPU;
- KVM/hardware virtualization;
- persistent storage;
- ephemeral storage;
- network ingress/egress;
- Android guest support;
- Linux desktop/browser support;
- display transport;
- touch/input transport;
- native keyboard transport;
- model runtime;
- user-owned model loading;
- model refinement/training;
- machine vision;
- embeddings/search;
- secrets/human gates;
- authentication/session;
- persistent lifecycle;
- ephemeral lifecycle;
- health/recovery.

The orchestrator selects by required capability plus cost class, not by hard-coded provider preference.

## Cloud Android consequence

The OCI Ampere VM remains a valid capability failure for accelerated Cuttlefish because hardware KVM is not exposed.

This must not turn AWS Graviton metal or OCI bare metal into a required development dependency.

The next Cloud Android implementation search is:
1. user-owned ARM64/x86 host with KVM;
2. genuinely free cloud host with usable KVM;
3. genuinely free Android/remote-device substrate satisfying the contract;
4. optional paid metal only when explicitly authorized.

The existing production viewer and Broccoli Core transport contracts remain reusable regardless of substrate.

## Persistence model

Every deployment should declare one of:
- persistent: preserve guest state and reconnect to the same logical device;
- ephemeral: destroy guest state automatically after completion or expiry;
- checkpointed: preserve explicitly requested state while allowing compute to disappear.

The lifecycle manager owns creation, health, recovery, checkpointing, reconnect, and destruction.

## Model ownership

The architecture must not assume hosted proprietary inference.

A model provider is an interchangeable execution backend. Supported backends should include user-owned local models, self-hosted model servers, open model runtimes, and optional hosted APIs.

Training/refinement follows the same rule: use user-owned/free compute when possible, degrade to capability reporting when resources are insufficient, and never silently incur charges.

## Evidence policy

A capability is PASS only after functional evidence.

Examples:
- KVM PASS requires a usable virtualization device and successful guest execution.
- Android screen PASS requires an actual framebuffer/display result.
- keyboard PASS requires physical input reaching Android.
- persistence PASS requires state surviving reconnect.
- model execution PASS requires an actual inference.
- machine vision PASS requires an actual image processed by the selected vision backend.

Ports, processes, package installation, and configuration files alone are not PASS evidence.

## Security and sensitive work

Ephemeral mode is a first-class deployment type for journalism, quick tests, sensitive information, and one-off automation.

Secrets must be scoped to the deployment and excluded from diagnostics and logs.

Persistent mode must make storage and retention explicit.

## Current decision

The OCI ARM64 VM KVM blocker is NOT a reason to buy infrastructure.

Paid ARM64 metal is an optional accelerator.

The primary engineering task is provider-neutral capability discovery and free-first substrate selection.

## Related work

- Grasshopper #143: Production Cloud Android substrate
- Grasshopper #144: Always-Free Capability Matrix and Agentic Substrate Selection
- Knowledge graph: OCI ARM64 Cloud Android Production Pivot, 2026-10-05