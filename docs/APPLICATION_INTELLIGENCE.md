# Application Intelligence

## Purpose

Grasshopper should understand an application before it automates it.

The application intelligence layer combines static inspection, live UI observation,
semantic element modeling, bounded actions, verification, and resumable human
handoffs.

## Execution loop

discover -> observe -> model -> plan -> act -> observe -> verify

If the application changes, the agent re-observes instead of blindly replaying
coordinates or brittle DOM paths.

## Android

The bounded Android contract is:

Grasshopper -> broccoli-core CLI -> Rish -> Shizuku -> Android shell

The current application actions are:

- device.identity
- display.list
- ui.dump
- package.inspect
- package.export
- app.launch
- app.stop with explicit confirmation
- tap
- swipe
- text
- keyevent

package.export copies the installed APK to the user's shared Downloads area.
tools/apk_inspector.py can then inventory the APK without executing its contents.
Platform tools such as aapt2, aapt, or apkanalyzer are used when available.

## Web

The web observation adapter is intentionally browser-framework-neutral at its
boundary. A Playwright adapter is included. Playwright's role, label, text, and
test-id locators are designed around user-facing semantics and retry current
DOM elements rather than relying on stale coordinates or long CSS/XPath paths.

The adapter captures URL, title, semantic controls, and an ARIA snapshot when the
installed Playwright version supports it.

## Human boundary

Security and authorization boundaries are not automation failures.

When the observation layer detects a boundary such as authentication, MFA,
CAPTCHA, bot checks, security keys, biometrics, consent, or payment
authorization, the task becomes:

HUMAN_REQUIRED -> PAUSED -> user completes boundary -> RESUME -> VERIFY

The system does not solve, bypass, or weaken the boundary.

The handoff includes a checkpoint so the task can resume without losing the
agent's state.

## Evidence contract

Successful execution is not established by exit code alone.

A promoted action needs structured evidence containing the action, transport,
result, and observable target-side evidence. Empty output with exit code zero
remains NOT_PROVEN.

## Security boundary

Static application inspection is analysis only. APK contents are never executed
by the inspector.

Mutating Android actions remain allowlisted and bounded. Destructive process
control requires explicit confirmation.

## Portability

The model and human-boundary contracts are platform-neutral. Android, web, and
future Linux desktop executors provide platform-specific observation and action
adapters while Grasshopper retains orchestration, checkpoints, evidence, and
promotion decisions.
