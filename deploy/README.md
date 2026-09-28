# OmniKali portable deployment

The application contract is Kubernetes. Provider folders contain only infrastructure adapters.

## Targets

- `providers/gcp`: Google Kubernetes Engine
- `providers/aws`: Amazon EKS
- `providers/azure`: Azure Kubernetes Service
- `providers/oracle`: Oracle Kubernetes Engine
- `providers/local-k3s`: K3s on self-managed or low-cost infrastructure

## Required order

1. Create a Kubernetes cluster with the provider adapter.
2. Install a persistent shared-storage driver and create the `omnikali-shared` StorageClass.
3. Install the provider workload-identity mechanism.
4. Install an ingress/Gateway implementation.
5. Install PostgreSQL and provider secret integration, or point the control plane at an existing provider-neutral PostgreSQL service.
6. Build the multi-architecture Kali image.
7. Deploy the Helm chart.
8. Deploy the desktop provisioner.
9. Run the acceptance matrix.

## Free deployment paths

K3s is the baseline no-license-cost path. GKE has a current free trial and free-tier program, but eligibility and underlying resource costs must be checked before creating resources. The project never assumes that a cloud provider is permanently free.

## Portability rule

Do not copy provider credentials, ARNs, project IDs, resource IDs, DNS names or secret values into `deploy/helm`. Put those values in the provider profile or runtime secret system.
