# Oracle phone viewer repair — 2026-10-04

Goal: migrate the working Android experience to OCI, repair its phone UI, and
continue Grasshopper/Broccoli integration. AWS is not the target environment.

The OCI viewer now serves phone.html using the existing token gateway and
stream adapter. Existing vnc.html remains available. The phone page always
scales the canvas to its container; it does not ask Android to resize.
Controls use native details/summary, default collapsed, with bounded width,
scrollable height, and a 44px minimum control height. VisualViewport resize
and scroll events update the layout as the phone keyboard opens.

Local text composition remains local until Type text is pressed. Committed
Unicode code points become RFB key events without splitting surrogate pairs.
The remote text field must already be focused. Enter and multiline input can
submit a focused form, so users should verify the target before sending.
No draft text is logged, stored, or automatically replayed after disconnect.
Reconnect only replaces the RFB viewer connection, never the Android runtime.

## Deployment and recovery

Run bash scripts/android-worker/phone/install.sh from any working directory.
It anchors source paths, preserves the upstream noVNC tree, retains token
routing, preflights websockify, and installs the user gateway service.
The gateway loads websockify using the existing bundled module directory.
The first attempt lacked PYTHONPATH and failed; that cause is now fixed.
Unit restart is enabled. Real host reboot survival remains unverified.

Recovery: stop grasshopper-viewer-gateway with systemctl --user, then run
PYTHONPATH=/opt/noVNC/utils/websockify python3 -m websockify
with --token-plugin TokenFile --token-source ~/.desktop-session/token-map
--web /opt/noVNC --heartbeat 30 127.0.0.1:6081.
Existing Android data and stream adapter remain untouched.

## Evidence and limits

Three input/viewport helper tests pass; npm test passes 206 tests.
External phone HTML returns 200 and external RFB capture passes at 486x964.
PNG SHA256: 4707bda4595596083bdcba31ff6a2366c94c90ad6916788a5b1eeef80f3c9667.
Interactive browser verification was blocked by net::ERR_BLOCKED_BY_CLIENT.
Phone IME delivery, touch/scroll, panel geometry under real keyboard resize,
native display resolution, and hiding emulator chrome remain unproven.
The temporary existing capability token expires on its original schedule.

The target is OCI Android compute, not merely OCI ingress. On the inspected
Oracle host no local emulator/QEMU process was found; the adapter consumes
a loopback SSH relay at 16080. The current compute source must be verified
before claiming migration complete. Historical AWS descriptions alone do
not identify this live stream. No AWS resource was changed in this repair.

The viewer remains a UI boundary. Broccoli event observations must never
replay input. Provider/governor integration and local hardware handoff are
separate gates; this UI repair does not claim those complete.
