# OmniKali EKS Remote Desktop Architecture

User browser
  -> CloudFront
  -> authenticated Helix gateway
  -> Cognito
  -> PostgreSQL RDS
  -> desktop provisioner
  -> per-user Kali desktop Pod
  -> noVNC/websockify
  -> XFCE and Firefox

EKS provides:
- gateway Deployment
- task workers
- desktop provisioner
- per-user desktop workloads
- observability
- elastic compute

Storage:
- RDS PostgreSQL for durable control-plane state
- EFS for persistent user workspace and browser profiles
- EBS for non-shared low-latency workloads
- Secrets Manager through EKS Pod Identity

Desktop isolation:
- user-scoped Pod
- user-scoped Service
- user-scoped EFS access point
- CPU and memory limits
- NetworkPolicy
- no host networking
- no direct node SSH
- no browser cookies or Cognito client secrets in the desktop Pod

The public surface remains the gateway. noVNC is not directly exposed to the internet.

The Kubernetes Pod lifecycle is not the source of truth for task ownership. PostgreSQL state and leases remain authoritative.

This is an explicit change from the current VM-backed Kali execution environment. It requires independent acceptance before replacing the production EC2 path.
