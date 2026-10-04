# OmniKali Execution System Identifiers - 2026-10-01

Use these identifiers in future agent handoffs so "the server", "the phone", or "the workstation" is never ambiguous.

| Logical role | Human name | RDC device ID | Runtime identity |
|---|---|---|---|
| Android execution target | `android-phone-a146u` | `566d623e-df45-4b16-b2be-4cbd08567a49` | Samsung SM-A146U, Android 15/API 35, aarch64 |
| Persistent ARM cloud patch/build host | `oci-grasshopper-workstation` | `0852e6f4-2507-4d0f-9d62-f6eda8cdd169` | Oracle Linux 9.8, aarch64, OCI us-ashburn-1 |
| AWS cloud host | `aws-helix-worker-01` | `882f1036-235b-4669-acaf-1e1135b156bd` | Debian 13, x86_64, AWS us-east-1 |

## Cloud identifiers

OCI:

- Hostname: `grasshopper-workstation`
- Instance OCID: `ocid1.instance.oc1.iad.anuwcljr6fkonhictbomvyszuwiri6kl6ja3gb5i2ji2csx6njewpymlxpiqiad`
- Region: `iad`
- OS: Oracle Linux Server 9.8
- Kernel: 6.12.0-206.104.4.4.el9uek.aarch64

AWS:

- Hostname: `ip-172-31-8-59`
- Instance ID: `i-03b6a82d46271d9cd`
- Region: `us-east-1`
- OS: Debian GNU/Linux 13 (trixie)
- Kernel: 6.12.107+deb13-cloud-amd64

## Naming rule

Use the logical identifiers above in:

- GitHub issue/PR comments
- evidence documents
- agent checkpoints
- process logs
- APK patch job records
- remote desktop handoffs

Never use "the server" or "the phone" when more than one execution system is available.

## Role separation

`android-phone-a146u`:
- human-facing Android UI
- Termux
- Shizuku/Rish
- installed-app observation and safe interaction
- final APK installation and post-install verification

`oci-grasshopper-workstation`:
- persistent ARM64 build/patch workspace
- APKTool/JADX/AAPT2/Morphe Desktop workloads
- patch-source builds
- artifact cache
- repeatable patch jobs

`aws-helix-worker-01`:
- existing AWS execution capacity
- secondary build/test capacity
- do not assume it is the canonical patch host until explicitly assigned

This separation keeps resource-heavy APK work off the phone without coupling the Android transport to a particular cloud provider.
