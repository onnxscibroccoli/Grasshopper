# Remote Provider-Agnostic Browser Plane 2026-10-01

## Goal

Web automation should not depend on OpenClaw running on the Grasshopper Oracle host or on the Android device. A provider-agnostic remote browser worker can host persistent browser profiles for services such as ChatGPT, Grok, Gemini, GitHub, and future providers.

## System identifiers

- Android edge: RDC `localhost` / `566d623e-df45-4b16-b2be-4cbd08567a49`
- Oracle control workstation: RDC `grasshopper-workstation` / `0852e6f4-2507-4d0f-9d62-f6eda8cdd169`
- AWS worker candidate: RDC `ip-172-31-8-59` / `882f1036-235b-4669-acaf-1e1135b156bd` / EC2 `i-03b6a82d46271d9cd`

## Browser profile model

Use one isolated persistent profile per provider/account/workspace, never one shared browser profile.

Example identity:

`browser://aws-c7i-flex/provider=chatgpt/profile=primary`

The profile directory is durable encrypted storage. It is never committed to Git and never copied into application logs.

Playwright officially supports persistent browser contexts through a dedicated user-data directory, and its authentication model supports reusing saved authenticated state. This makes persistent remote sessions a natural implementation boundary.

## Provider adapter contract

Each provider adapter should expose the same control-plane interface:

- `open(provider, profile)`
- `observe()`
- `find(selector)`
- `act(action)`
- `verify(expectation)`
- `checkpoint()`
- `humanGate()`
- `close()`

The provider adapter owns provider-specific URLs and UI semantics. The executor, checkpoint system, evidence model, and human-gate behavior remain provider agnostic.

## Human gate

If login, CAPTCHA, biometric approval, OTP, payment confirmation, security verification, or another human-only step appears:

1. stop automated mutation
2. preserve the browser profile and workflow checkpoint
3. stream or expose the live browser surface to the user's phone
4. notify the user
5. wait
6. reobserve
7. require a deterministic completion condition
8. resume the same loop

The system must never bypass CAPTCHA, MFA, biometric checks, or security verification.

## Separation of concerns

- Android is the mobile human edge and optional local executor.
- Oracle is the durable control-plane/orchestration host.
- AWS/OCI workers can provide disposable or persistent browser/build capacity.
- Provider adapters are interchangeable.
- Authentication state is a protected runtime artifact, not source code.
- Browser sessions and APK patch workers use the same checkpoint/evidence model.

## Evidence status

- Provider-agnostic architecture: DESIGN
- Persistent authenticated browser profile: SUPPORTED BY PLAYWRIGHT DESIGN
- ChatGPT/Grok/Gemini live remote profiles: NOT_PROVEN
- Cross-provider observe/action/verify: NOT_PROVEN
- Human-gate remote browser resume: NOT_PROVEN
