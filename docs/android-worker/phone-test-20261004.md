# Physical phone access interval — 2026-10-04

Cloud Android chat continuity is the working baseline, confirmed by the user.
Native local keyboard delivery and usable controls are NOT_PROVEN; the user
reported the replacement viewer worsened their experience. Preserve the Android
session and userdata; do not reset it or treat transport tests as UI acceptance.

Desktop Commander localhost device came online. Existing Broccoli Rish wrapper
returned physical screen 1080x2408, physical DPI 450, override DPI 420, font scale
0.8. These are live local phone readings, not emulator readings. No settings changed.

An ACTION_VIEW request opened the OCI phone-viewer URL in Chrome. Subsequent
screenshot retrieval was delayed by reconnect. The retrieved screenshot showed
Termux's Desktop Commander recovering a pending remote call; it did not show
the viewer. Therefore neither control geometry nor local keyboard delivery was
visually verified. Further screen switching stopped to preserve human control.

Next acceptance gate: stable phone RDC across foreground changes, visible viewer
capture, open/close controls, native IME composition, type into an isolated test
field without submitting a chat, then verify exact remote text and scrolling.
Terminal, Chrome, ChatGPT, Grok and Gemini are the requested application set.
Integrate them incrementally through the existing Governor/event bus. Observe
must never replay user input; authentication and payment gates remain human owned.
No automated message was sent and no cloud Android process was restarted.
