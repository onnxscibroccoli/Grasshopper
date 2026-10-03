# Human authentication gate

**Status:** proposed reference contract on `feat/human-auth-gate`  
**Owner:** Grasshopper control plane, with Helix and Broccoli adapters  
**Security posture:** human-required authentication boundaries remain human-required

## Purpose

OmniKali needs a clean way to pause an automation loop when a website or native application requires real user presence, let the user complete that boundary from a trusted phone surface, verify the original session, and resume the exact task checkpoint.

This is a human-in-the-loop authentication broker. It is **not** a CAPTCHA solver, MFA bypass, passkey relay, or credential proxy.

## Control flow

```text
automation loop
  |
  v
observe current UI
  |
  v
detect HUMAN_REQUIRED boundary
  |
  v
auth.gate.detected
  |
  +--> freeze side-effect execution
  +--> preserve task + opaque checkpoint reference
  +--> preserve original browser/app session reference
  |
  v
sanitized relay event
  |
  +--> private Outside Agent / phone notification
  +--> Helix trusted remote-session surface
  |
  v
user completes challenge in the trusted provider/original session
  |
  v
auth.gate.user-completed
  |
  v
VERIFYING
  |
  +--> re-observe original session
  +--> verify post-challenge state
  +--> if provider returned credentials, store them in the credential vault
  |    and retain only a namespaced credentialRef
  |
  v
auth.gate.verified
  |
  v
human.boundary.cleared
  |
  v
resume task from checkpoint
```

## State machine

```text
DETECTED
  -> WAITING_FOR_USER
  -> VERIFYING
     -> RESUMED
     -> WAITING_FOR_USER   (retryable verification failure)
     -> FAILED

Any non-terminal state -> CANCELLED
Any non-terminal state -> EXPIRED
```

Only `RESUMED` permits the suspended automation to continue. `FAILED`, `CANCELLED`, and `EXPIRED` halt the gated task rather than silently continuing.

Duplicate successful verification is idempotent only when it names the same original session and the same credential reference.

## Security invariants

1. Raw passwords, OTPs, CAPTCHA answers, cookies, bearer values, access tokens, refresh tokens, and ID tokens never enter the auth-gate event stream.
2. Chat is a control/notification plane. A user's chat message saying “done” can request verification, but it cannot itself clear the gate.
3. The verifier must check the **original** browser/app session after the user action.
4. Browser state is not serialized into Git, logs, prompts, Drive, or an Outside Agent conversation.
5. Provider credentials, when a protocol yields them, go directly to the credential vault. The runtime receives only a provider-neutral `credentialRef`.
6. The phone relay receives only sanitized metadata: gate id, task id, provider, reason, mode, state, and expiry. Session references, credential references, and checkpoint references stay internal.
7. The gate has a short expiry and explicit cancellation path.
8. Human input takes precedence over automated input while the gate is active.
9. CAPTCHA, WebAuthn/passkey, biometric, security-key, and payment-authorization boundaries are never automatically solved or emulated.

## Handoff modes

### SAME_SESSION

Use for CAPTCHA, bot checks, MFA, WebAuthn/passkey, biometrics, consent, payment authorization, and login flows whose challenge exists in the current browser or app.

The user opens the trusted Helix/OmniKali remote session from the phone and interacts directly with the original UI. Broccoli can provide the same behavior for Android-native application sessions.

### OAUTH_DEVICE

Use only when the provider officially supports an out-of-band device authorization flow.

OAuth 2.0 Device Authorization Grant (RFC 8628) is the model: the authorization server gives the client a short-lived device authorization transaction and gives the user a verification URI/user code. The user authenticates at the authorization server; the client waits for the provider to report approval. The provider-facing device code and resulting access token remain server-side.

Do not synthesize a device flow for a provider that does not support it.

## Component ownership

### Grasshopper

Owns:
- durable gate state;
- task/checkpoint association;
- event ordering and idempotency;
- pause/resume disposition;
- credential-reference contract;
- recovery after worker restart.

### Helix

Owns:
- authenticated browser/desktop handoff;
- short-lived trusted phone entry surface;
- binding a handoff to the correct user and workspace/session;
- live session continuity.

The preferred path keeps the original browser context alive. Exported browser storage is credential material and must not be used as a chat payload or repository artifact.

### Broccoli

Owns:
- Android accessibility/UIAutomator gate evidence;
- package/window/session identification;
- native-app re-observation after human completion;
- emitting the same provider-neutral gate events.

Broccoli must use the canonical Rish/accessibility transport and should not introduce a parallel authentication state machine.

### Outside Agent

Outside Agent is the owner-facing notification and control surface, not the credential store.

Recommended first deployment:
- private visibility;
- owner-only web access;
- sanitized gate notifications only;
- no raw screenshots containing credentials;
- no OTP/password/CAPTCHA answer collection;
- no cookies or bearer tokens;
- a connector to the Grasshopper gate-control API only after that API has a real deployed URL and authenticated connector contract.

SMS can be added later as a notification channel, but the sensitive interaction still opens the trusted Helix/provider surface.

## Provider adapters

ChatGPT/OpenAI, Gemini/Google, Grok/xAI, and future model providers implement the same adapter contract:

```text
classify(observation) -> human boundary | null
handoffMode(boundary) -> SAME_SESSION | OAUTH_DEVICE
verify(originalSession) -> cleared | still_blocked | failed
credentialStrategy -> session_only | vault_reference
```

The planner and Governor do not contain provider-specific authentication logic. They react only to the common gate events.

## Detection inputs

A detector can combine:
- URL/origin or Android package identity;
- title/window identity;
- accessibility text;
- semantic roles;
- explicit provider error states;
- repeated no-progress observations.

Existing Grasshopper detection already covers authentication, MFA, CAPTCHA, bot checks, security keys/passkeys, biometrics, consent, and payment authorization. This change adds an OAuth authorization boundary while keeping all of them human-required.

## Acceptance tests

Minimum release gate:

1. CAPTCHA detection pauses the task.
2. Relay serialization contains no internal session/checkpoint/credential references.
3. A chat/user-completion signal moves the gate only to VERIFYING.
4. Verification from a different session cannot clear the gate.
5. Fresh observation of the original session can clear it.
6. A credential-producing provider yields only a namespaced credential reference.
7. Raw token/password/OTP/CAPTCHA-answer fields are rejected.
8. Duplicate successful completion is idempotent.
9. Cancelled/expired/failed gates cannot resume the task.
10. Worker restart can reconstruct the gate from durable state and preserve the suspended task.
11. Existing human-handoff behavior remains compatible.
12. Full repository tests and the no-Broccoli-degradation guard remain green.

## Standards and implementation notes

- RFC 8628 provides the standard out-of-band device authorization pattern. Respect provider polling intervals, expiry, denial, and backoff.
- WebAuthn ceremonies intentionally require user presence or user verification and keep private credential material inside the authenticator.
- Playwright browser storage state can contain cookies, local storage, IndexedDB data, and credentials capable of impersonating a user. Keep it out of source control and outside the chat relay.

## Next increment

After this pure contract is green in CI, implement one authenticated Grasshopper gate-control endpoint and one Helix/Broccoli adapter against it. Then connect the private Outside Agent to that **real** endpoint. Do not invent a connector URL or secret during the reference-contract phase.
