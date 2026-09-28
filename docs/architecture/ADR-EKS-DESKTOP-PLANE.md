# ADR: Move Remote Desktop Execution to Amazon EKS

Status: proposed implementation change.

Decision:
Use Amazon EKS as the scalable execution substrate for containerized Kali remote desktops.

Existing verified behavior:
The production control plane provides authenticated gateway access, PostgreSQL persistence, durable task states and leases, worker recovery, and verified Kali execution. Those contracts remain authoritative.

Reason:
An EC2-per-desktop model couples each user to a complete virtual-machine lifecycle. EKS separates desktop workload lifecycle from node lifecycle and allows horizontal scheduling.

Compatibility impact:
The execution environment changes from a KVM/QEMU Kali VM to a Kali Linux container. This changes the kernel boundary, boot model, filesystem model, GUI startup, browser persistence, and resource isolation. Existing VM acceptance evidence does not automatically validate the container path.

Migration:
1. Build the Kali desktop image.
2. Deploy one isolated desktop.
3. Integrate Cognito and the existing gateway.
4. Add EFS persistence.
5. Add dynamic per-user provisioning.
6. Add node autoscaling.
7. Run failure and multi-user acceptance.
8. Keep the EC2 path available as rollback until EKS passes acceptance.

Required acceptance:
AUTH -> DASHBOARD -> PROVISION -> NOVNC -> FIREFOX -> PERSIST -> RECREATE

Also retain:
FIRST -> FIRST_COMPLETE -> DUPLICATE_BLOCKED

and worker termination, lease reclamation, cancellation, database interruption, and multi-user isolation.
