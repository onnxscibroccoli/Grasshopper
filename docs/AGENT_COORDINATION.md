# Agent coordination contract

This document is the coordination boundary for concurrent agents working on Grasshopper and the OmniKali execution framework.

## Primary rule

Together is better. Do not compete for the same mutable boundary.

Agents must work cooperatively from the current repository truth. A second agent may investigate, test, or propose a fix, but it must not silently replace, reset, force-push, or invalidate another agent's active work.

## Authority order

Use this order when sources disagree:
1. Fresh live acceptance/runtime evidence
2. Production contracts and schemas
3. Verified source at an exact commit
4. Knowledge graph and tracked goals
5. README/documentation
6. Historical chat or stale artifacts

Unproven claims stay NOT_PROVEN, HYPOTHESIS, PLANNED, or BLOCKED.

## Ownership and leases

Before changing a boundary:
1. Identify the repository, environment, execution surface, and current owner/PR.
2. Search open branches/PRs for overlapping work.
3. If an active PR already owns the same boundary, extend that work or coordinate with it. Do not create a competing implementation.
4. Keep one clear lead implementation for each runtime boundary.
5. If ownership is unclear, make a read-only investigation and publish evidence before changing code.
6. Never force-push or move another agent's branch ref without an explicit handoff.

The owner is the agent/PR currently carrying the smallest coherent implementation toward the next acceptance gate. Ownership can transfer only through an explicit handoff recorded in the PR or coordination evidence.

## Current Cloud Android coordination

- ARM64 native OCI Cloud Android is the active new-runtime path.
- PR #162 is the parent implementation for the ARM64 runtime.
- PR #163 is the immediate corrective follow-up for the ARM64 UEFI startup-path regression. Treat it as stacked/cooperative work, not a competing runtime.
- The old Android-x86/TCG implementation remains a behavioral benchmark and preserved artifact, not a reason to restart destructive graphics experiments.
- PR #160 is a separate legacy/x86 graphics experiment. It must not silently rewrite the ARM64 runtime or change the production AWS Helix/Kali boundary.
- AWS Helix/Kali remains protected and independent. Cloud Android experiments run on the OCI workstation unless a separately authorized migration says otherwise.

## Shared-host rule

On a shared workstation or host:
- Never stop, restart, reset, or reconfigure another agent's live workload merely to obtain cleaner evidence.
- Use a disposable state directory, guest disk clone, container, port, and log path for experiments.
- Record the exact process/container identity before and after a change.
- Preserve known-good artifacts.
- If a live workload is the acceptance target, test it in place only through its declared contract and without destroying session state.

## Change protocol

Every substantive change follows:

inspect -> provenance -> choose owner -> smallest change -> narrow test -> acceptance -> evidence -> publish

A failed test is evidence. Do not erase the failure by resetting the workspace or weakening the test.

## Merge and promotion

- PRs are the durable unit of collaboration.
- Keep fixes small and reviewable.
- Do not merge an overlapping PR merely because its branch is newer.
- Before merge, compare the exact proposed head with the current base and all active stacked PRs.
- Do not mark a stage complete from process liveness alone.
- Runtime promotion requires executable evidence at the declared acceptance boundary.

## Handoff format

When handing work to another agent, publish:
- current owner/PR
- exact commit SHA
- files/boundaries owned
- last known-good evidence
- current blocker
- next executable test
- preserved state/artifact paths
- explicit non-goals

The receiving agent must continue from that state rather than reconstructing the work from chat.

## Anti-regression rule

If a known-good path exists, add a regression assertion before changing it. Do not clean up working code while solving a separate blocker.

The goal is not to make one agent win. The goal is to move the system forward while leaving the next agent with more verified capability than the previous agent had.
