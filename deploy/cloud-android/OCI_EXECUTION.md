# OCI Cloud Android execution

Cloud Android execution is routed to the preconfigured OCI Grasshopper workstation in `us-ashburn-1`.

The AWS Cloud Android worker is disabled after the 2026-10-07 Stage 0 resource-admission failure. The AWS Helix Kali VM remains independent and running.

The OCI workstation uses its local Podman-managed QEMU runtime. It has 12 GiB configured memory and currently hosts the disposable Cloud Android worker with 2 GiB guest memory. KVM is unavailable on this ARM Flex workstation, so QEMU TCG is the explicit acceleration mode.

OCI API discovery is not required for this local execution path. The workstation identity is established through OCI instance metadata. API instance-principal access is currently insufficient to enumerate the compartment, so no OCI control-plane mutation is performed by this routing change.

The legacy Cloud Android implementation remains the behavioral benchmark and is not deleted or overwritten.
