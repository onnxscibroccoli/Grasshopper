# Cloud Android persistent agent/user session

This adds a second persistent remote surface alongside the existing workstation desktop session.

## Runtime
- Android-x86 9.0-r2, pinned by SHA-256.
- QEMU/KVM virtual Android device with persistent ext4 data disk.
- Loopback-only ADB forwarding on 127.0.0.1:5555.
- Loopback-only VNC framebuffer on 127.0.0.1:5903.
- Token-gated noVNC/websockify presentation on 127.0.0.1:6082.
- noVNC reconnect behavior keeps the Android VM independent from browser/WebSocket lifetime.
- ADB control is intended for MCP/RDC automation; the VNC/noVNC surface is the user-drivable surface.

## Security boundary
The Android VM control ports default to loopback. The public edge must authenticate the browser session before proxying the noVNC HTTP/WebSocket path. ADB is not published directly to the Internet.

The development image disables Android ADB transport authentication inside the VM because the host forwarding is loopback-only. This is a development/control-plane property, not a public exposure mechanism.

## Physical Android
The physical Android device should receive only the authenticated noVNC session URL through the existing Ruto/RDC path. The cloud VM remains the execution environment. The physical phone is the user-facing display/input endpoint.

## Acceptance gate
1. VM boots and retains state across VM/browser reconnects.
2. noVNC renders the real Android framebuffer.
3. Pointer/keyboard input changes the Android VM state.
4. MCP/RDC can execute control actions through the Android control channel.
5. Browser disconnect/reconnect does not destroy the VM.
6. Public access remains behind the authenticated HTTPS edge.
7. The physical Android can open the authenticated session without repeated VNC credential prompts.

The current implementation is the transport/control-plane foundation. Browser sign-in to ChatGPT and permanent public-edge promotion remain integration gates, not assumptions.