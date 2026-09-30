# OCI authenticated desktop

The OCI workstation must never expose the VNC server or noVNC backend directly.

The browser edge is nginx over HTTPS. OAuth2 Proxy authenticates the browser session before nginx proxies the request to localhost noVNC. WebSocket traffic remains inside the authenticated path.

Default policy:

- TCP 5901: localhost only
- TCP 6080: localhost only
- TCP 443: authenticated desktop
- TCP 80: HTTPS redirect only
- TCP 22: management-only and removed from the public security list after convergence
- unknown OAuth identities: denied

The gateway uses OAuth2 Proxy 7.15.4 and supports GitHub, Google, or generic OIDC. The provider credentials are never committed to source control.

For GitHub, the default authorization subject is the repository owner account `onnxscibroccoli`. A different explicit account can be supplied through `GRASSHOPPER_GITHUB_USER`.

OAuth2 Proxy supports WebSockets and nginx auth_request integration. See the upstream documentation for the required reverse-proxy trust settings.