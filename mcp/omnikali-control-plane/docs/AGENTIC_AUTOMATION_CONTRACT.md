# OmniKali Agentic Automation Contract

## Goal

OmniKali is an orchestration layer, not a single automation backend. It can use the phone as an execution surface while delegating browser work, model planning, APK analysis, and other compute to cloud or local workers.

## APK-first application inspection

Installed applications are inspectable artifacts. The control plane can:

1. resolve the installed APK with `pm path` through the canonical Broccoli/Rish boundary;
2. copy the APK to the device shared OmniKali artifact directory;
3. run the existing Broccoli static inspector without executing APK contents;
4. inventory manifest/tool output, resources, DEX files, native libraries, and layout candidates;
5. combine static APK evidence with a live semantic UI snapshot.

Static inspection is evidence about the package, not proof that a UI control exists at runtime. Runtime state always wins for action selection.

## Agent loop

Every bounded Android automation run follows:

`observe -> detect human boundary -> plan -> locate -> act -> re-observe -> verify -> re-plan`

The model is a planner only. The executor validates every selector against the current observation. Coordinates are never reused from an earlier state.

Actions are intentionally small: tap, text entry into an editable target, and back navigation. The loop has a hard step limit and returns its trace so the next agent can continue from evidence instead of repeating guesses.

## Human boundary

CAPTCHA, authorization, biometric, one-time-code, payment approval, and security-verification surfaces stop the loop with `HUMAN_REQUIRED`. The agent returns the current observation and checkpoint instead of attempting to defeat the control.

## Web automation

For browser environments, use a dedicated browser adapter rather than inventing a new DOM executor. Playwright supports Chromium, Firefox, and WebKit and has an MCP integration; Appium provides UiAutomator2 for Android native, hybrid, and web automation. The control-plane contract should normalize both into the same observe/act/verify event model.

See the official Playwright documentation for browser and MCP configuration, and Appium's UiAutomator2 documentation for Android automation. 

## Evidence discipline

- `PASS` means the requested behavior was executed and observed.
- `NOT_PROVEN` means implementation or partial observation exists but the acceptance behavior was not demonstrated.
- A model plan is not evidence.
- A static APK layout candidate is not runtime evidence.
- A security boundary is never treated as an automation failure when the correct behavior is to pause for the user.

## Portability

Phone execution, browser execution, and cloud workers are adapters. The knowledge graph records the adapter, evidence, and failure boundary so a later agent can choose another environment without rediscovering the same problem.