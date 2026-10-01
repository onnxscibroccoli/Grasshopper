# OmniKali APK UI Automation Contract

## Principle

The installed application UI is an automation surface in its own right. OmniKali must not require a vendor API, paid automation API, private SDK, or application-specific integration when the same operation can be performed through the device's normal UI.

The primary loop is:

`observe -> understand -> locate -> act -> observe -> verify -> remember`

A model may reason over the resulting semantic UI map and optional screenshot. The executor performs deterministic device actions.

## Observation

1. Capture the Android UI hierarchy through the Broccoli/Rish boundary.
2. Parse nodes into stable semantic fields:
   - text
   - content description
   - resource id
   - class
   - package
   - clickable/enabled/focusable state
   - bounds and center point
3. Capture a screenshot when hierarchy information is missing, ambiguous, canvas-rendered, or visually important.
4. Never assume an old coordinate remains valid after a state transition.

## Action selection

Prefer, in order:

1. Exact resource-id match.
2. Exact content-description match.
3. Exact text match.
4. Stable semantic text match.
5. Class/package plus spatial relationship.
6. Coordinates only when the current observation supplied those coordinates.

After every mutating action, reacquire the UI and verify the expected state transition.

## Existing-app rule

The executor does not need source code for the target APK. Native Android, Compose, Flutter, WebView, and other rendered UIs are treated as presentation surfaces. Maestro documents this same outside-the-app, presentation-layer model. Appium's UiAutomator2 driver is another established Android automation option. citeturn0search3turn0search13

## Human boundary

Security prompts, authorization, CAPTCHA/bot checks, biometric prompts, payment approval, and other actions that intentionally require the user remain explicit `HUMAN_REQUIRED` checkpoints. The agent must pause with a checkpoint, not attempt to defeat the control.

## Local-model rule

A local LLM is a planner, not the executor. The model receives normalized UI observations and proposes an action. The deterministic executor validates the selector against the current screen, performs the action, and verifies the result.

This makes model changes replaceable without changing the device-control layer.

## Recovery

When a selector fails:

1. Re-observe.
2. Compare semantic tree changes.
3. Re-plan once.
4. Try an alternate selector class.
5. Fall back to visual/screenshot reasoning.
6. Stop at a human boundary instead of guessing through authorization/security UI.

Repeated failure becomes an artifact for the knowledge graph rather than another duplicate script.

## Security

UI automation has the same policy boundary as process execution. Read-only observation can be automatic. Mutating actions require an explicit execution context and confirmation policy. Credentials are never inferred from screenshots or UI text and are not written into automation artifacts.

## Broccoli recovery

Recovered implementations currently informing this contract include:

- `a11y-apk/BroccoliA11yService.kt`
- `a11y-apk/A11yCommandReceiver.kt`
- `lib/rish_ui.sh`
- `lib/ui_dump_rish.sh`
- `lib/broccoli_rish_ui.py`
- `lib/broccoli_ui_dump.py`

These are source material. Grasshopper owns the contract and the canonical execution path so the old duplication problem does not return.
