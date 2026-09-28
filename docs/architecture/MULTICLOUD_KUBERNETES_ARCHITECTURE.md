# OmniKali Multi-Cloud Kubernetes Architecture

## Objective

Make OmniKali portable across managed Kubernetes services and self-managed Kubernetes without changing the application contract.

## Layers

1. Portable application: Helix gateway, PostgreSQL task/state/lease contract, workers, desktop provisioner, Kali desktop container, noVNC, browser and telemetry.
2. Kubernetes contract: Deployments, Services, Jobs, ConfigMaps, Secret references, PVCs, NetworkPolicies, Gateway API, resource requests and limits.
3. Provider adapter: cluster creation, identity, load balancer, persistent storage, secret integration, autoscaling and registry.
4. Provider: AWS EKS, Google GKE, Azure AKS, Oracle OKE, or self-managed K3s/upstream Kubernetes.

## State boundary

PostgreSQL remains the durable control-plane source of truth. Desktop Pods are replaceable. User state lives on persistent storage. Kubernetes state is orchestration state, not task ownership.

## Multi-user model

Each user receives a scoped desktop workload, dedicated Service, dedicated workspace/access point, resource quota, network policy and authenticated gateway route.

## Portability rules

Application manifests must not contain AWS ARNs, GCP project identifiers, Azure resource IDs, OCI OCIDs, provider-specific secret values or provider-specific DNS assumptions. Provider-specific values belong under deploy/providers.

Container images must support linux/amd64 and linux/arm64 so Arm free-tier and edge environments remain viable.

Storage is abstracted through Kubernetes PVCs. The provider profile supplies the StorageClass.

Identity is abstracted through workload identity or Pod Identity. Application containers receive short-lived identity rather than static cloud credentials.

## Free-access strategy

OmniKali can be free and open-source, but cloud infrastructure is not universally free. GKE currently provides a $74.40 monthly free-tier credit for eligible zonal or Autopilot cluster management, while compute is billed separately. EKS currently charges $0.10/hour per cluster in standard mode plus worker and other resource charges. AKS cluster management is free while node resources remain chargeable. Oracle documents Always Free compute resources and a free Basic OKE cluster, subject to account, region and capacity limits. K3s is open-source and can run on self-managed machines.

Therefore free for anyone means no OmniKali license fee, no provider lock-in, a free/self-hosted deployment path, and provider free tiers where currently available. It does not promise zero infrastructure cost on every provider.

## Scalability

Pending desktop Pods express CPU and memory demand. Cluster autoscaling adds capacity. The provisioner creates desktops only when requested. Idle desktop policies can suspend or destroy compute while retaining workspace. The shared control plane scales independently.

Instantaneous is an acceptance metric, not an assumption. Measure p50 and p95 authentication, desktop provisioning, Pod readiness and browser-ready latency for every provider.

## Acceptance matrix

AUTH -> DASHBOARD -> PROVISION -> NOVNC -> FIREFOX -> PERSIST -> RECREATE

FIRST -> FIRST_COMPLETE -> DUPLICATE_BLOCKED

Also test worker termination, lease reclamation, cancellation, database interruption, network interruption, multi-user isolation, horizontal scale, and clean teardown/reconstruction.
