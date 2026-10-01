# Grasshopper / Broccoli Human Gate Contract - 2026-10-01

## Ownership

This capability belongs to the Grasshopper/Broccoli agentic execution layer.

OmniKali may consume it, but OmniKali is not the source of truth for the human-gate lifecycle.

## Contract

When an agent encounters CAPTCHA, OAuth authorization, biometric verification, OTP/2FA, payment approval, or another security/authorization boundary:

1. Stop mutation immediately.
2. Persist the current goal, step, detected UI evidence, and checkpoint ID.
3. Leave the target application in its current foreground state.
4. Capture a screenshot to shared OmniKali storage.
5. Notify the phone user that human action is required.
6. Enter WAITING_FOR_HUMAN.
7. Re-observe the device periodically.
8. Do not resume until the human-gate indicators disappear on two consecutive observations.
9. Automatically resume the same agent loop from the checkpoint.
10. If the wait deadline expires, return WAITING_FOR_HUMAN with a durable checkpoint instead of failing or restarting the task.

## Current implementation

Grasshopper PR #115 now contains:
- human-gate checkpoint persistence
- screenshot capture
- Termux notification handoff
- bounded polling for completion
- automatic resume after two consecutive gate-free observations
- configurable human wait timeout from 10 seconds to 30 minutes
- fail-closed timeout behavior

Termux:API provides the notification mechanism used for the phone handoff. Its notification interface supports persistent IDs and image paths.

## Security rule

The agent never attempts to defeat the human gate.

A CAPTCHA, OAuth authorization, biometric prompt, OTP/2FA challenge, payment approval, or security verification remains a human operation.

## Evidence labels

Implementation exists: PROVEN by repository tests and syntax checks.

Live human-gate end-to-end:
NOT_PROVEN.

The missing evidence is a real challenge on the phone followed by:
human interaction -> UI transition -> automatic detection -> same-loop resume -> final verification.

Do not label the live gate PASS until that evidence exists.

## Related transport boundary

This feature does not modify the canonical Broccoli Rish wrapper.

Current transport evidence remains:
- Rish: PASS
- uid=2000(shell): PASS
- SDK 35: PASS
- direct Rish -> uiautomator: PASS
- MCP UI executor: still the B2 integration boundary
