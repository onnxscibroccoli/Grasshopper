[Reading 38 lines from start (total: 38 lines, 0 remaining)]

# OmniKali GUI Arbitration Invariant

## Non-negotiable rule

Human GUI input always wins. Input from the mobile browser, desktop browser, noVNC, or any other human-facing UI must never be blocked, captured, disabled, or prevented by an agent.

## Agent behavior

1. Agent GUI control is cooperative, never exclusive.
2. A human activity signal causes the agent to yield immediately.
3. Yielding means pause/defer the agent GUI action; it does not lock the desktop.
4. Human input remains available while an agent is operating.
5. The UI may show a subtle non-interactive amber/yellow visual indicator that an agent is active.
6. The indicator must never capture pointer or keyboard events.
7. Terminal/background work may continue unless the human explicitly stops it.
8. After the human becomes idle, the agent may resume according to its task policy.
9. Agent GUI actions must be auditable as yielded/resumed events.
10. No future GUI lock may be implemented in a way that prevents human input.

## Priority

Human input > GUI arbitration > agent GUI input.

## Required control-plane semantics

- `human_active`: advisory state indicating recent human activity.
- `last_human_input`: timestamp of most recent human interaction signal.
- `agent_yielded`: agent state when human activity is detected.
- `agent_resumed`: agent state after the configured idle period.
- `GUI_LOCK` must not be used as an input-blocking mechanism.

## Visual treatment

Use a subtle amber/yellow tint, border, badge, or equivalent non-interactive overlay to communicate agent activity. Never use a modal, pointer-capturing, keyboard-capturing, disabled, or focus-stealing overlay.

## Restore-state invariant

This policy is part of the OmniKali restore-state contract and must be preserved across future architecture changes, agent integrations, and UI rewrites.

[executed on device: ip-172-31-8-59 (882f1036-235b-4669-acaf-1e1135b156bd)]