# OmniKali AWS CDK + Ansible CI/CD Strategy

Status: implementation strategy and launch gate
Authoritative AWS IaC: AWS CDK
Host configuration: Ansible
CI/CD: GitHub Actions with short-lived OIDC credentials
Protected production path: CloudFront -> nginx -> Helix -> libvirt/QEMU -> Kali

## Ownership
CDK owns AWS bootstrap, IAM trust, VPC, networking, CloudFront, ACM, DNS, RDS, Secrets Manager, KMS, EC2, EBS, SSM and observability. Ansible owns OS packages, files, systemd, libvirt/QEMU host configuration, Helix runtime configuration and host hardening. Helix owns workspace lifecycle. Kubernetes remains a separate prototype. One controller owns each resource.

## Canonical IaC
Use AWS CDK as the authoritative AWS IaC engine. Do not have CDK and Pulumi manage the same resources. Pulumi remains a future option for a genuinely multi-cloud boundary or a deliberate replacement of CDK for a defined scope.

## Two-stage fresh-account bootstrap
Stage 0 is a provider-account trust bootstrap performed by a controlled one-time administrator or provider-native account/project setup. AWS Organizations/Control Tower may be used when available, but is not required. Stage 0 creates the provider federation trust, narrowly scoped deployment role, permissions boundary and IaC bootstrap state. Stage 1 is GitHub-controlled deployment using short-lived federation. The same ordering applies to every supported provider.

## CDK stacks
OmniKaliBootstrapStack, OmniKaliNetworkStack, OmniKaliDataStack, OmniKaliEdgeStack, OmniKaliComputeStack, OmniKaliObservabilityStack and OmniKaliApplicationConfigStack. Keep stateful data resources isolated from frequently changed compute and edge constructs.

## Ansible
Use amazon.aws.aws_ec2 dynamic inventory and amazon.aws.aws_ssm connection. Prefer SSM over public SSH. Tag hypervisors with OmniKaliRole=hypervisor. Ansible converges pinned packages, Node/runtime dependencies, libvirt/QEMU, systemd units, root-owned runtime configuration, logging, KVM checks, service health and prohibited-port checks. It does not create AWS networking, RDS, CloudFront, IAM foundations or persistent storage.

## Repository target
infra/cdk/{bin,lib,test}; infra/ansible/{inventories,group_vars,roles,site.yml,requirements.yml}; scripts/ci/{validate-iac.sh,deploy-platform.sh,configure-host.sh,acceptance.sh}; docs/architecture; docs/evidence. Terraform may remain temporarily as migration evidence but must not remain a second production owner after CDK adoption.

## CI/CD
Pull request: dependency verification -> compile/tests -> cdk synth --strict -> cdk-nag/policy checks -> CloudFormation validation -> ansible-lint -> Ansible syntax check -> secret scanning. No production mutation.
Merge: GitHub OIDC -> cdk diff -> approval for stateful changes -> CDK deploy -> CloudFormation stabilization -> dynamic inventory -> Ansible converge -> service verification -> authenticated desktop acceptance -> task execution -> evidence.
Release metadata must contain Git SHA, CDK assembly hash, CloudFormation stack IDs, EC2 instance IDs, AMI ID, Ansible versions, Helix SHA, timestamp and acceptance IDs.

## Ordering
CDK bootstrap -> network -> data -> edge -> compute -> CloudFormation stable -> SSM online -> Ansible common -> Ansible hypervisor -> Ansible Helix -> service health -> guest provisioning -> authenticated WSS/RFB -> task execution.

## Security
No long-lived AWS credentials in GitHub. Separate bootstrap, deployment, verification and runtime permissions. Secrets come from Secrets Manager and never enter Git or CI logs. No public VNC, websockify, libvirt or QMP.

## Drift
CloudFormation/CDK owns AWS drift. Ansible owns OS drift. Helix owns workspace lifecycle. Kubernetes owns only its prototype. Periodic verification runs infrastructure drift detection, Ansible check mode, host/service health, guest reconciliation and prohibited-port checks.

## Provider-neutral sandbox launch gate
At least one disposable provider sandbox must prove identity isolation, workload create/destroy, production credential denial, bounded cleanup, immutable source convergence, host/guest acceptance, persistent recovery, ephemeral TTL reclamation, no public management listeners, and later authorized-agent workspace rediscovery. AWS-specific acceptance additionally covers RDS, Secrets Manager, CloudFront/ACM/DNS, EC2 KVM and SSM. Provider-specific IaC is selected by the adapter rather than hard-coded into the control-plane contract.

## Production protection
Do not replace the existing production Terraform deployment in place, automatically import production into CDK, move CloudFront/nginx, introduce Kubernetes ingress, expose VNC/websockify, reset the live Helix checkout, or merge a provider migration solely because synthesis succeeds.

## Pulumi contingency
Pulumi is an alternative owner, not a parallel owner. A future migration requires inventory, import, no-op preview, freeze of CDK writes, acceptance, then removal of CDK ownership only after reconciliation.