# OCI phone viewer repair — 2026-10-04

The OCI phone viewer is a thin native-mobile client over the existing tokenized noVNC/RFB transport. The remote Android runtime, VNC server, stream bridge, and token gateway are not restarted or replaced by viewer changes.

## Input architecture

The viewer uses a hidden native textarea only as an IME bridge. It is never a remote text composer.

- Printable/mobile text is delivered through browser input events.
- beforeinput handles semantic backspace, delete, and line-break operations.
- IME composition is buffered and committed once at compositionend.
- keydown is reserved for modifiers and non-text/navigation keys.
- noVNC RFB.sendKey() remains the only remote keyboard transport.
- No typed text is logged, persisted, or replayed.
- The input buffer is cleared after each transmission so a prior character cannot become the prefix of the next mobile edit.

This follows the browser event model instead of trying to force mobile IMEs through synthetic keydown events. The noVNC RFB API provides explicit key sending and keyboard focus methods.

## Control surface

The previous large collapsible control panel was removed. The remote framebuffer is the primary interface and owns normal pointer/touch input through noVNC.

The remaining overlay is intentionally small:

- Keyboard: activates the native phone IME bridge.
- Release keyboard: returns focus to the remote surface.
- Fit: restores viewport scaling without resizing the guest.
- Fullscreen: toggles browser fullscreen.
- Reconnect: reconnects only the viewer transport.
- Ctrl+Alt+Del: explicit system key sequence.
- Status: connection state only.

The menu is an affordance, not a second control plane. It does not duplicate touch, pointer, text, clipboard, or Android application behavior that the RFB session already provides.

## Verification

- npm test: 209/209 PASS.
- phone input tests: 6/6 PASS.
- stream bridge tests: 4/4 PASS.
- viewer HTTP endpoint: 200.
- viewer is serving phone.mjs?v=4.
- Android runtime was not restarted.
- Browser-level Playwright verification is currently unavailable on this OCI workstation because the Playwright Node module is not installed. That remains an explicit verification gap rather than a claimed pass.

## Recovery

The pre-change viewer files are preserved at:

- /srv/grasshopper/android/evidence/phone.mjs.pre-control-repair
- /srv/grasshopper/android/evidence/phone.html.pre-control-repair

The existing earlier native-repair backup remains under /srv/grasshopper/android/evidence/viewer-before-native/.

This is a viewer/input repair. It is not a claim that the full Android physical-keyboard acceptance gate or end-to-end agent automation gate is complete.
