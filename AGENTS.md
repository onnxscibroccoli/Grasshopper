# Grasshopper agent operating contract

This repository is the clean reference/control-plane project for OmniKali. Existing production systems are evidence, not a reason to bypass reproducibility.

## Safety boundary

The live AWS Helix/Kali system is a protected BASE SYSTEM / PROTOTYPE.

Agents must not, without an explicit migration plan and human authorization:

- replace or reconfigure nginx, CloudFront origin behavior, Helix gateway/auth, PostgreSQL, libvirt/QEMU, VNC/noVNC, or the production Kali workload
- bind, DNAT, proxy, or otherwise capture ports 80/443 or other production ingress
- enable or reconfigure the host K3s control plane or bundled ingress networking
- copy production credentials into a workstation, container, image, Git repository, workflow, prompt, or log
- use production state as the hidden dependency of a supposedly clean reproduction

Before changing a shared host, record listeners, routes, container/network state, relevant service status, Git state, and a restore point when practical.

## Agent execution rules

1. Prefer reversible, isolated changes.
2. Make one bounded change at a time.
3. Run the narrowest relevant test immediately after each change.
4. Preserve evidence: command output, commit SHA, test result, and failure cause.
5. Never treat a running process, pod, or VM as proof of health.
6. Do not claim exactly-once execution unless the executor contract proves it.
7. Never bypass a failing verification merely to make CI green.
8. If a repair changes infrastructure, prove the public contract again.
9. Prefer short-lived cloud identity such as GitHub OIDC or OCI instance principals over long-lived credentials.
10. Keep repository-specific credentials scoped to this repository and out of bootstrap/user-data.
11. Human GUI input always takes precedence over agent input on remote desktops.
12. If an action is destructive or difficult to reverse, stop before that action and request explicit authorization.

## OCI workstation

OCI is the persistent enforcement and development target for the Android worker. Preserve the working cloud chat and its storage. Screenshots, tunnel hostnames, and historical implementations do not authorize changing the target architecture. Use OCI and Remote Desktop Commander for this repair; do not access AWS unless the user explicitly reauthorizes it. Do not reset or replace a working Android session to repair its viewer. The OCI environment must not become a hidden trust dependency of the protected AWS production base.

The canonical convergence path is:

- scripts/oci-workstation-rebuild.sh
- scripts/oci-workstation-agent-bootstrap.sh

The workstation should be reproducible from source and should retain an audit record under ~/.grasshopper/audit/.

## Self-correction loop

observe -> classify -> isolate -> repair -> test -> record -> continue

A failed repair is evidence. Preserve the failure and the attempted fix rather than hiding it.

## Cloud authentication

GitHub Actions should use OIDC for AWS and other supported cloud providers. Workflows should request only the permissions required by the individual job. Do not add long-lived AWS access keys to GitHub secrets when OIDC can provide the required access.

OCI compute workloads should prefer instance principals where the required dynamic group and least-privilege policy exist.

## Release discipline

Every infrastructure change must be traceable to:

- repository commit SHA
- source file/script
- target environment
- execution timestamp
- verification result

A clean source checkout plus a passing test suite is the minimum reproducibility signal, not the final production acceptance criterion.

## Automatic merge gate

Automatic merging is permitted only after the repository production-contract gate passes in full.

The gate requires:

- the complete repository test suite to pass
- the required production-contract GitHub Actions workflows for the exact proposed commit to pass
- a documented and verified recovery path to be present
- no production credentials or production infrastructure mutation by the agent

When the pull request is non-draft and every gate is green, the guarded merge workflow may enable GitHub auto-merge. A failing or incomplete gate must not merge.

The recovery evidence currently used by the gate is the verified OpenClaw backup plus disposable restore drill recorded in the dated OCI DEV_SANDBOX evidence. This is recovery readiness evidence, not a claim of automatic production rollback.

If post-merge validation fails, the response must use the documented revert/restore path and preserve the failure evidence. Do not silently continue after a failed production-contract validation.

## Broccoli degradation guard

Read `docs/DEGRADATION_LESSONS.md` and `docs/PORTABILITY_AND_EXECUTION_BOUNDARIES.md` before adding a transport, a script, or a status claim.

Do not repeat these:

- a doc whose body is "see chat"
- a milestone called shipped while the file is a placeholder
- a new root script per incident
- a second copy of a known-good executor
- RC=0 with no artifact treated as PASS
- editing `rish_run.sh` because a new caller failed
- assuming the caller cwd or Bash exists inside a remote Android shell
- treating a transport identity proof as end-to-end RDC or desktop proof

Run `node scripts/verify-no-broccoli-degradation.mjs` after structural changes. `npm test` includes `test/degradation-guard.test.mjs`.
