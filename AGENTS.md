# Grasshopper agent operating contract

This repository is the clean reference/control-plane project for OmniKali. Existing production systems are evidence, not a reason to bypass reproducibility.

## Safety boundary

The verified Grasshopper/Kali remote desktops and any independently validated production system are protected BASE SYSTEMS. OCI is the persistent Android-worker target. Historical AWS topology is not permission to redirect work to AWS.

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

The OCI Grasshopper workstation and Kali container are **protected, working user access systems**, not disposable. The OCI host is shared across them and Android experiments. Never disrupt existing browser/noVNC/RustDesk/HTTPS access, operating services, mounts, container identities or their recovery channels when prototyping. New Android runtimes require explicit admission and rollback.

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

**Automatic merging is not permitted.** The repository production-contract gate must pass, and explicit human approval is required for every merge. An agent may open a draft pull request but must never enable auto-merge or merge to main.

The gate requires:

- the complete repository test suite to pass
- the required production-contract GitHub Actions workflows for the exact proposed commit to pass
- a documented and verified recovery path to be present
- no production credentials or production infrastructure mutation by the agent

When a pull request is non-draft and every gate is green, obtain **explicit human approval** before merging. A failing, incomplete, or unapproved gate must not merge.

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

## Main-only source reads and public privacy enforcement — 2026-10-13

1. **Agent source reads must specify the canonical `main` branch. Never fetch a GitHub file via raw commit-SHA refs, unmerged branches, salvage worktrees or historical clones as a source of truth.** Git revision identifiers may be recorded as opaque evidence metadata, but are not retrieval targets.
2. Propose modifications on isolated feature branches rooted in `main`; local generated files and changes are not production evidence until separately tested. PR reviews and CI may validate changes, but agents must not use branch snapshots as canonical architecture.
3. **Never commit personal identifiers, private contact addresses/numbers, health information, account credentials, OAuth/authentication material, cloud identity keys, tokens, sessions, raw Android disks or unredacted user interaction logs.** This applies to documentation, tests, comments, prompts, CI artifacts, issues and PR bodies. A scanner is a supplement, not a replacement for privacy review. Never print matches in tool output.
4. If a public file already exposes personal data, prepare a deidentified replacement immediately. A replacement in a feature branch does not remove the current public file or historical Git object; coordinate human-reviewed merge, history/cache remediation separately.
5. A deidentified cross-device mission spec is recorded in `docs/architecture/UNIFIED_ACCESSIBLE_DEVICE_RUNTIME.md`. Always preserve its long-term goals even when a particular transport is currently blocked: physical Android, persistent cloud Android, remotely windowed Linux/Kali apps, semantic UI/action/control schemas, provider-independent model and MCP access, gated approvals, chat/voice development and self-hosted free-tier operation.
6. Prior QEMU experiments may be removed **only** where proven inactive/nonfunctional, unique source and test findings are privately archived or deidentified in Git, and Kali, Android guest, RustDesk, viewers and recovery channels have passed continuity checks. Never remove the active QEMU merely because Redroid is proposed.
7. A change/event observation must never replay the originating action. All cross-device execution must be idempotent, scoped and auditable.

**Production promotion requires real user-visible acceptance, not a superficial process/transport PASS.**
