# Persistent Remote Desktop Session Contract

## Problem

A browser reconnect can reach noVNC again while the underlying VNC server requests its VNC credential again. That creates a human synchronization point and can stop an autonomous Android/RDC workflow.

## Implemented transport

`scripts/desktop-session/persistent-session.sh` adds a second transport without modifying the existing protected VNC server:

1. Keep the existing X display as the desktop source.
2. Mirror that display with TigerVNC `x0vncserver` on a second loopback-only RFB port.
3. Use `SecurityTypes=None` only on that internal mirror.
4. Put websockify in front of the mirror and require a random per-session token.
5. Store the token and connection URL mode `0600` under the session state directory.
6. Enable noVNC autoconnect and automatic reconnect.
7. Keep the X session and desktop alive when the browser/WebSocket client disconnects.

The existing VNC credential is not read, changed, copied, or embedded by this transport.

## Security boundary

The x0vncserver mirror and websockify listener default to loopback. They must not be exposed directly to the Internet. The public edge must authenticate the browser session before proxying HTTP and WebSocket traffic to the loopback listener.

The existing OCI gateway pattern already has OAuth2 Proxy cookie sessions, cookie refresh, and WebSocket proxying. Browser authentication belongs at that edge. The VNC layer should not become the user authentication layer.

Nginx must explicitly pass WebSocket `Upgrade` and `Connection` headers and use a long enough `proxy_read_timeout` for the persistent connection.

## Reconnect semantics

```text
Android browser
      |
      | authenticated browser session
      v
public HTTPS edge
      |
      | authenticated HTTP + WebSocket
      v
127.0.0.1:6081 websockify
      |
      | session token
      v
127.0.0.1:5902 x0vncserver
      |
      | X11
      v
same persistent XFCE display
```

A browser or WebSocket failure therefore does not terminate the desktop. The next connection reuses the same X display and can reconnect without another VNC credential dialog.

## Current workstation evidence

On 2026-10-03 this transport was exercised against the existing Grasshopper workstation display `:1` using a temporary token-gated websockify endpoint and a Cloudflare Quick Tunnel. The physical Android reached the new noVNC page and rendered the workstation display. The framebuffer visibly contained the workstation's existing XFCE/Chrome/terminal state, demonstrating that `x0vncserver` mirrors the same desktop rather than creating a second desktop.

The temporary public tunnel is development evidence only. Cloudflare documents Quick Tunnels as temporary testing infrastructure, not production transport.

## Acceptance gate

A deployment is `PASS` only when all of these are true:

- authenticated browser session is established once;
- Android sees the actual persistent desktop canvas;
- pointer and keyboard input reach that desktop;
- browser/WebSocket disconnect does not terminate the desktop;
- browser reconnect returns to the same desktop state;
- no VNC credential dialog appears after reconnect;
- unauthenticated public access is rejected;
- VNC and the internal WebSocket bridge remain loopback-only;
- session tokens are not committed to Git or logged in plaintext;
- the existing protected VNC credential remains unchanged.

A temporary Quick Tunnel proves the transport mechanics only. Production PASS additionally requires promotion behind the permanent authenticated HTTPS edge.
