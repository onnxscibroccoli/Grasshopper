# OCI phone viewer repair — 2026-10-04

OCI is the persistent enforcement and development target for the Android worker. The working cloud chat must be preserved. Use OCI and Remote Desktop Commander only; do not infer authorization to access another provider from a screenshot or historical topology.

## Viewer changes

The existing phone.html route uses the existing OCI token gateway and stream adapter. The separate draft/Type text interface has been removed. A hidden browser IME input forwards input changes through noVNC key events immediately; it is not a user-facing composer. Phone keyboard focuses that input after the remote field is selected. Composition replacements and backspace use Unicode code points. No text is logged, persisted, or replayed after reconnect.

Controls collapse to one summary button; all other controls are inside the panel. The panel scrolls within the VisualViewport and the canvas fits its container without resizing Android. Coarse-pointer control sizes also account for a desktop-width browser viewport. Reconnect affects only the viewer.

## Verified and unresolved

- Six input helper tests pass; the full npm suite passes 209 tests.
- OCI headless Chromium at 393x760 connects through the actual token gateway without page errors; controls open and close.
- At 393x340 the panel bottom is 332px, within the viewport. The native IME bridge receives browser focus. This is not proof of a physical IME opening.
- Physical phone RDC screenshots at 17:26–17:28 Eastern show the supplied tunnel, live remote content, and the repaired panel opened and collapsed.
- Native physical phone keyboard delivery into the remote field is NOT verified. A cloud Android keyboard remains visible in the capture. Automated taps paused when text changed outside test actions, to respect human input.
- Before the OCI-only correction, an input diagnostic observed keys at the display server but no matching Android kernel keyboard event. No runtime restart/reset was performed. Further provider access is prohibited by the user's correction.
- The smoke test message has NOT been sent; the end-to-end automation loop does not pass acceptance yet.
- The structural guard still reports existing false_shipped failures in BROCCOLI_KNOWLEDGE_GRAPH.md and DEGRADATION_LESSONS.md, plus the missing portability marker. Do not bypass or merge with those failures.

## Deployment and recovery

The three static viewer files are served from /srv/grasshopper/android/viewer on OCI. Static-file replacement does not restart the gateway, adapter, or Android. Before-repair copies are at /srv/grasshopper/android/evidence/viewer-before-native/. Restore phone.html, phone.mjs, and input.mjs from that directory to roll back this repair.

The installer remains scripts/android-worker/phone/install.sh. No Android storage, runtime, or account state is replaced by this viewer change. Evidence includes native-repair-frame.png, input-s-probe.png, viewer-mobile-layout.png, and native-viewer-tests.txt under /srv/grasshopper/android/evidence/. Physical screenshots are in /storage/emulated/0/Download/grasshopper-viewer-test.png on the phone.

This is an incomplete UI repair, not production acceptance or proof of completed compute migration. Persistence, automation-loop verification, and Grasshopper/Broccoli integration remain separate acceptance gates.

## Native composition follow-up, 17:33 Eastern

The user confirmed that the physical keyboard opens but text does not arrive remotely. A real-browser regression probe found the imported noVNC Keyboard handler cancelling keydown events with keyCode 229 / Unidentified. The viewer now leaves IME and printable key events to the browser and forwards their input deltas. Navigation and modifier keys have explicit paired handling, including release on blur. This removes an observed browser-side defect; it does not establish that every downstream input defect is fixed.

Run scripts/android-worker/phone/verify-native.mjs with PLAYWRIGHT_MODULE pointing to an installed Playwright module. It verifies uncancelled composition/printable events and collapsible panels at three viewport sizes without typing into the remote session. All checks pass. Physical delivery remains pending because RDC calls stalled again after the local restart. No AWS access occurred after the user's OCI/RDC-only correction.
