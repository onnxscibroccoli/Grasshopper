# AWS — New-Account Free Plan / Credit-Limited EC2 Test Workers

**Account status: UNKNOWN; don't assume AWS is permanently free.** New AWS accounts created **on or after 2025-07-15** may have a Free plan lasting **up to six months or until their credits expire**. Eligible EC2 types reported by AWS include `t3.micro`, `t3.small`, `t4g.micro`, `t4g.small`, `c7i-flex.large`, `m7i-flex.large`. Accounts created earlier have a different, typically 12-month legacy offer. These are **time-limited**, not perpetual zero-charge VMs.

Official: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html ; https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-FAQ.html

## Step-by-step

1. Sign in through https://console.aws.amazon.com/ as an authorized account owner; complete MFA on Amazon only. Check Billing & Cost Management → Free Tier / Free Plan and the account's creation date/credit expiration. **If Paid plan or account beyond offer window, STOP.** Credits are not equivalent to a no-billing guarantee. Protect root account and configure IAM Identity Center if available.
2. On an OS with AWS CLI v2, use IAM Identity Center configuration where the organization provides an access portal:
   ```bash
   aws configure sso --use-device-code
   aws sso login --profile YOUR_SSO_PROFILE --use-device-code
   aws sts get-caller-identity --profile YOUR_SSO_PROFILE
   ```
   **IAM Identity Center must already be provisioned/configured**; an isolated personal account cannot blindly run `configure sso` without an Identity Center start URL and assigned permission set. Never create long-lived access keys just to satisfy automation.
3. Examine current instances/volumes/IPs across each enabled region (not just `us-east-1`). Region candidates `us-east-1`, `us-east-2`, `us-west-2` subject to shape stock, account enablement and costs:
   ```bash
   aws ec2 describe-instance-types --region us-east-1 \
     --filters Name=free-tier-eligible,Values=true \
     --query 'InstanceTypes[].InstanceType' --output text
   aws ec2 describe-instances --region us-east-1 --profile YOUR_SSO_PROFILE
   aws ec2 describe-volumes --region us-east-1 --profile YOUR_SSO_PROFILE
   ```
4. Review AWS Billing Free Tier usage (actual tracked quotas) and the projected costs for running full months. Public IPv4, EBS storage, snapshots, egress, CPU Unlimited bursting, NAT gateways and premium AMIs can create **unexpected billable charges**. The free EC2 type filter is **only** a shape label.
5. Future gated creation: choose official Linux AMI explicitly labelled eligible, matched architecture (`t4g.*` ARM64, `t3.*` x86), Free plan/account eligibility, reviewed boot EBS disk, and zero ingress except restricted private/SSM access. Set CPU credit mode to standard (not unlimited) where applicable and never create a NAT Gateway for a free worker. Review final cost and TTL before clicking Launch.
6. Validate worker responds to approved SSH/SSM, then terminate temporary EC2 resources before time/credits expire; remove orphan EBS disks, snapshots and paid IPs. Never run a fleet of permanent EC2 under credits in a "zero-billable forever" system.

## GitHub workload federation

Use GitHub-issued OIDC → AWS STS with a dedicated least-privilege role and a tight trust condition on repository/branch/environment. Source: https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws . The human owner must establish trust through authorized IAM admin actions, and permissions should start at read-only. The included workflow requests no OIDC tokens.

**Default planner status:** `TRIAL_OR_CREDIT_LIMITED`; no automatic AWS deployment.
