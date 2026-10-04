# Private Android companion stream — 2026-10-04

## Verified behavior

The OCI controller's 114 GiB volume is mounted at /srv/grasshopper with
111 GiB available. Android companion runs on the existing dedicated AWS
worker, reached through the established loopback relay at port 16080.
OCI's current ARM64 UEK kernel lacks CONFIG_ANDROID_BINDER_IPC and has no
/dev/kvm, so it is not used as an Android compute worker.

The existing Android configuration records 1080x2408 and 400 DPI.
Samsung documents 1080x2408 for Galaxy A14 5G. Actual phone density,
font scale and refresh settings have not been read; 400 DPI is provisional.
The live streamed canvas is 486x964 including emulator controls.
Scaling the canvas to a browser does not prove native-resolution streaming.

A streamed frame initially showed System UI not responding. Dismissing
the emulator CPU warning and choosing Wait returned to a usable home screen.
Do not classify this as a permanent performance repair.

## Transport

Phone browser -> existing HTTPS viewer -> token gateway on loopback 6081
-> stream_bridge.py on loopback 15910 -> existing companion WebSocket relay
on loopback 16080 -> Android worker's VNC server.

The existing desktop token continues to route to its original destination.
A separate random Android capability token selects port 15910.
Tokens are stored only in mode-0600 controller runtime files; never commit
them or a live URL. A transient systemd timer removes the Android route
after one hour. Removal blocks new connections; existing connections may
remain until they disconnect. This is a temporary token-protected test
viewer, not Google OAuth, a stable production URL, or a native phone app.

Each viewer owns one upstream connection. Closing it closes that connection
only: no emulator commands, restarts, shell input or replay are performed.
The adapter binds only to 127.0.0.1 and limits concurrent viewers to eight.
Failures are reported as viewer/upstream transport events, not VM boot state.

## Reproduce adapter

Install a Python venv on the mounted data volume:
```bash
python3 -m venv /srv/grasshopper/android/stream-tools
/srv/grasshopper/android/stream-tools/bin/pip install websocket-client==1.9.0 Pillow==11.3.0
/srv/grasshopper/android/stream-tools/bin/python scripts/android-worker/test_stream_bridge.py
/srv/grasshopper/android/stream-tools/bin/python scripts/android-worker/stream_bridge.py
```

The live controller runs the adapter with the user unit
grasshopper-android-stream.service, Restart=on-failure, RestartSec=5,
NoNewPrivileges=true, UMask=0077. Its ExecStart is the venv Python plus
the absolute repository path to stream_bridge.py. The user bus requires
XDG_RUNTIME_DIR=/run/user/1001 and
DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1001/bus in RDC callers.

The existing gateway uses websockify TokenFile and reloads its map per
connection. Add an unpredictable token with a mapping of
`TOKEN: 127.0.0.1:15910`; preserve the other routes and mode 0600.
Use noVNC vnc.html with autoconnect=true, resize=scale, view_only=false,
and URL-encoded path=websockify?token=TOKEN. Do not open new ingress ports.
Provision access-token removal before advertising a test link.

## Acceptance evidence

- Four adapter tests passed: bidirectional binary transport, viewer close,
  upstream close and rejected text frames.
- Repository npm test: 203 passed, zero failed.
- Real external WSS/RFB handshake and raw framebuffer capture passed.
- Frame: 486x964. PNG SHA256:
  0ee28460f3191184521c59924e91e5f8b89d3dbb4c103c25c232cc193d55ef11.
- Service active; frame obtained after reconnect through the new adapter.
- Physical-phone visual playback confirmed by the user's Galaxy A14 screenshot
  at approximately 15:55 Eastern on 2026-10-04. It displays the remote Android
  Chrome session through noVNC, including the emulator toolbar. The screenshot
  establishes playback, not touch/scroll correctness or native resolution.
- Follow-up capture at approximately 20:00 UTC passed: 486x964, PNG SHA256
  012530e8c892a68a9e7cb4bd9afc572f4af1867838691ef55a75902cf675e4ae.
  The stream adapter remained active. Capture shows Android Chrome and worker
  side-panel pixels; worker framing is the source of the extra controls.
- Physical-phone gestures still require verification. The phone's RDC device
  was offline during follow-up, so actual DPI and font scale remain unread.
- Exact display-density match, native-resolution canvas, dev viewer,
  camera/SMS routing and post-reboot service health remain unproven.
- The available AWS host role denied ssm:SendCommand and
  ssm:DescribeInstanceInformation for the dedicated companion worker.
  No permissions were expanded and no production ingress was changed.

## Recovery

Remove only the Android token-map entry to revoke new Android access.
Stop the user unit grasshopper-android-stream.service to close adapter
connections. Preserve the existing desktop mapping and the companion relay.
Neither action modifies Android userdata or worker services.
The existing cloudflared process and worker relay are dependencies;
their reboot/restart persistence was not established by this test.

## Separate repository guard failure

The standalone degradation guard failed on unchanged baseline files:
false_shipped:docs/BROCCOLI_KNOWLEDGE_GRAPH.md,
false_shipped:docs/DEGRADATION_LESSONS.md, and the lowercase required marker
in docs/PORTABILITY_AND_EXECUTION_BOUNDARIES.md. The npm suite remained green.
The guard currently matches historical mentions of shipped/placeholders and
uses a case-sensitive marker. No guard rule or baseline document was changed
to bypass it. This change must remain draft until that gate is resolved.
