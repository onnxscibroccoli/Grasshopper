# RDC to Termux to Rish engineering gate

Date: 2026-10-01
Device: `android-phone-a146u` / Samsung SM-A146U
Android API: 35
Broccoli implementation: `d9a8d01` on `feat/rdc-termux-rish-bridge`
Broccoli PR: #63

## Status

**PASS**: the previously unproven Remote Desktop Commander caller boundary can reach the existing Android Rish transport without changing the canonical Rish wrapper.

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
- `package.inspect` for ChatGPT: PASS
- Focused Broccoli transport/action tests: 21/21 PASS
- Lower-level canonical Rish `ui.dump`: historically PASS
- Fresh RDC-originated `ui.dump`: **NOT_PROVEN** because the Android `uiautomator` process can hang on this live device

## Engineering decision

The caller boundary is detected before invoking Rish. Interactive Termux shells retain the canonical direct path. Reduced Android callers without `BOOTCLASSPATH` use Termux RunCommandService to re-enter a real Termux execution context, then invoke the same `lib/rish_run.sh`.

A timed-out direct Rish invocation is not automatically retried through another transport. This prevents duplicate Android mutations.

The UI dump now targets the proven shared-storage surface under `/sdcard/OmniKali/ui`, but the Android `uiautomator` service itself remains an independent runtime gate.

## Evidence boundaries

This closes the RDC-to-Rish transport gate. It does not close the RDC-to-uiautomator gate. It also does not prove that Google Cloud billing is active, that Google 2-step verification has been completed, or that CAPTCHA, OAuth, biometric, or other human/provider gates can be bypassed.

The complete historical Broccoli unittest discovery remains unhealthy on the current checkout because legacy `runtime.*` modules are absent and several old tests are placeholders/stale. That is recorded separately and was not used to downgrade the live transport proof.

## Next control-plane use

Android identity, package inspection, and bounded shell-backed actions can now be issued from RDC through the bounded Broccoli action dispatcher. UI hierarchy automation remains explicitly NOT_PROVEN until the `uiautomator` hang is resolved.
