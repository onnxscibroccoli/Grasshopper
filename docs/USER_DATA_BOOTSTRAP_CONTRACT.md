# User-data bootstrap contract

**Issue:** Grasshopper #63  
**Status:** Contract recorded. Does not change the validated production edge.

## Why this exists

An older remote-desktop reconstruction test required `AWS::SSM::Association` as a CloudFormation bootstrap resource. That Association introduced an SSM registration/bootstrap race and was removed from the reference stack.

Future agents must not restore `AWS::SSM::Association` merely to satisfy that obsolete assertion.

The file `test/full-remote-desktop-aws-stack.test.mjs` is not present on current Grasshopper `main`. This document and `test/user-data-bootstrap-contract.test.mjs` replace it.

## Current reference bootstrap

The current Helix AWS rebuild path is:

```text
Terraform infra/aws
  -> aws_instance.hypervisor
  -> user_data = file(infra/aws/user-data.sh)
  -> instance profile with AmazonSSMManagedInstanceCore
```

Source of truth for the script: `onnxscibroccoli/helix` `infra/aws/user-data.sh` and `infra/aws/main.tf`.

Grasshopper treats that stack as a **reference/rollback path**, not as the live CloudFront origin definition.

Issue #63 mentioned CloudFormation Launch Template user-data. The checked-in Helix rebuild module uses Terraform `user_data` on `aws_instance`. Do not invent a CloudFormation Association or Launch Template requirement to match the historical wording.

## Allowed vs forbidden

Allowed:

- EC2 user-data / cloud-init as the host bootstrap contract
- Instance profile + SSM Agent as an **operational** access channel (Session Manager / Run Command)
- Keeping the EC2 rebuild module as an isolated reference/rollback path

Forbidden:

- Declaring `AWS::SSM::Association` as a required provisioning resource
- Reintroducing an SSM Association race as a substitute for user-data
- Treating SSM Agent process health as proof of the authenticated Kali desktop
- Changing CloudFront, nginx `:80`, Helix `:8092`, or host ports `80/443` as part of this hygiene change

## Production path (unchanged)

```text
CloudFront -> nginx :80 -> Helix :8092 -> libvirt/QEMU -> helix-omnikali
```

This contract does not authorize FRP, Traefik, or Kubernetes as the public origin.

## Validation

```bash
node --test test/user-data-bootstrap-contract.test.mjs
```
