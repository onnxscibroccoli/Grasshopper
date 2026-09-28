# OmniKali EKS Reference Deployment

Amazon EKS is the scalable execution substrate for containerized Kali remote desktops.

Components:
- Amazon EKS
- EKS Pod Identity
- Karpenter or managed node groups
- AWS Load Balancer Controller
- Amazon EFS CSI
- Amazon EBS CSI
- RDS PostgreSQL
- Secrets Manager
- Cognito
- CloudFront

The control plane remains shared. Desktop workloads are user-scoped and disposable.

A desktop workload contains one Kali desktop Pod, one Service, one persistent EFS workspace, and one authenticated gateway route.

Deployment order:
1. network
2. EKS
3. IAM and Pod Identity
4. storage drivers
5. ingress
6. PostgreSQL
7. secrets
8. Helix gateway
9. Kali desktop image
10. desktop provisioner
11. per-user desktop
12. acceptance tests

Do not claim instantaneous capacity until concurrent provisioning and node-autoscaling latency have been measured.
