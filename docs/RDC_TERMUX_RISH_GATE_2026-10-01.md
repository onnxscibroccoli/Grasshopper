# RDC to Termux to Rish engineering gate

Date: 2026-10-01
Device: `android-phone-a146u` / Samsung SM-A146U
Android API: 35
Broccoli implementation: `18087e8` on `feat/rdc-termux-rish-bridge`
Broccoli PR: #63

## Status

**PASS**: the previously unproven Remote Desktop Commander caller boundary can now reach the existing Android Rish transport without changing the canonical Rish wrapper.

Live chain:

```text
Remote Desktop Commander child
  -> Android /system/bin/am
  -> Termux RunCommandService
  -> Termux bash
  -> broccoli-core/lib/rish_run.sh
  -> Shizuku/Rish
  -> Android shell uid=2000
```

## Live evidence

The proof was executed from an RDC-originated process on the Android phone.

- `device.identity`: PASS
- Rish identity: `uid=2000(shell)`
- Android SDK: 35
- Android device: `a14xm`
- `ui.dump`: PASS
- UI hierarchy root package: `com.openai.chatgpt`
- `package.inspect` for ChatGPT: PASS
- Focused Broccoli transport/action tests: 21/21 PASS

## Engineering decision

The caller boundary is detected before invoking Rish. Interactive Termux shells retain the canonical direct path. Reduced Android callers without `BOOTCLASSPATH` use Termux RunCommandService to re-enter a real Termux execution context, then invoke the same `lib/rish_run.sh`.

A timed-out direct Rish invocation is not automatically retried through another transport. This prevents duplicate Android mutations.

## Evidence boundaries

This closes the RDC-to-Rish transport gate. It does not prove that Google Cloud billing is active, that Google 2-step verification has been completed, or that CAPTCHA, OAuth, biometric, or other human/provider gates can be bypassed. Those remain explicit external gates.

The complete historical Broccoli unittest discovery remains unhealthy on the current checkout because legacy `runtime.*` modules are absent and several old tests are placeholders/stale. That is recorded separately and was not used to downgrade the live transport proof.

## Next control-plane use

Android automation actions can now be issued from RDC through the bounded Broccoli action dispatcher. The dispatcher remains allowlisted, package names remain validated, destructive app stop remains confirmation-gated, and arbitrary shell is not exposed as an Android action.
