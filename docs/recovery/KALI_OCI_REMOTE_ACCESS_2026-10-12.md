# OCI Kali workstation: browser access and RustDesk recovery evidence

**Evidence date:** 2026-10-12 EDT / 2026-10-13 UTC  
**Status:** Workstation running; browser transport operational; Android acceptance and direct-IP ingress incomplete.  
**Owner environment:** `kali-workstation` (RDC), Kali GNU/Linux Rolling 2026.3 on ARM64.  
**Scope:** This is the accessible Kali instance, **not evidence that the separate offline Grasshopper workstation was recovered**.

## Observed environment (live RDC evidence)

- PID 1 is `vncserver`, not systemd; the desktop is XFCE/X11 display `:1`.
- Existing TigerVNC process PID 10 on port 5901 was preserved.
- Persistent `/home/kali` mount was ext4 on `/dev/sdb` with approximately 33 GiB free of 112 GiB at inspection.
- Container/guest private address: `10.42.1.26`, routed through `10.42.1.1`. Public **egress** address `129.213.28.18`; this does not prove direct Internet **ingress** to a guest port.
- Public address `129.213.28.18:80` responded HTTP 200 from nginx 1.20.1 showing a directory listing. **Do not replace the existing host listener or expose secrets.** Access to the OCI host's proxy, firewall and routing has not been established.
- GitHub repo/README state is not runtime proof. No indexed RustDesk-specific instructions were found in repository code search at the time of this audit.

## Browser remote desktop transport

Existing X session is preserved; the original VNC password file at `/run/grasshopper/vnc-passwd` was a read-only bind mount and could not be rotated inside the guest. A second x11vnc mirror is used instead.

```text
Browser (HTTPS)
  -> temporary authenticated Cloudflare Quick Tunnel  [DEPRECATED as long-term ingress]
  -> local password/cookie gateway 127.0.0.1:6081
  -> noVNC v1.7 / websockify v0.13 on 127.0.0.1:6080
  -> x11vnc on loopback 127.0.0.1:5902
  -> existing X display :1 -> XFCE
```

- x11vnc binary and dependent libraries were extracted into `~/.local/opt/x11vnc` without modifying root package state.
- noVNC source is at `~/.local/opt/noVNC`. Local JavaScript patch changed default to **local scale**, disabled remote resizing, made the viewport zoomable and installed the opt-in `app/kali_zoom.js` zoom toolbar (`+`, `−`, `Fit`). The zoom toolbar currently uses private, version-pinned Display.scale APIs and requires actual Android touch validation.
- X display was tested at 1280×720 (16:9). A previously observed 411×788 mode was not suitable for the shared desktop.
- X11VNC temporary VncAuth file: `~/.local/state/kali-novnc/x11vnc-password` (0600). Rotate interactively with `~/.local/bin/change-kali-vnc-password`. Classic VncAuth recognizes only eight significant bytes. Do not publish the credential.
- Gateway authorization config: `~/.local/state/kali-novnc/auth.json` (0600); do not publish.
- Services in tmux: `kali-mirror`, `kali-novnc`, `kali-secure-web`, `kali-secure-tunnel`.
- Startup: `~/.local/bin/ensure-kali-novnc.sh` and `~/.config/autostart/kali-novnc.desktop`.
- Transport checks: unauthenticated GET -> login redirect, authenticated HTML -> 200, authenticated WebSocket -> 101, RFB `003.008` greeting observed. Original browser acceptance was reported by the operator; updated zoom/input flow remains unverified.
- **Cloudflare Quick Tunnel is temporary, URL unstable, and not the intended permanent IP ingress**. Do not stop this fallback before direct access passes.

## RustDesk (observed and changed)

- Existing rootless RustDesk **1.4.9** extracted AppRun installation: `~/.local/opt/rustdesk-1.4.9/AppRun`; no second RustDesk installation was created.
- Local configuration: `~/.config/rustdesk/RustDesk*.toml` (0600). Never commit these files (contain identity material, key material and trust metadata).
- Configured self-hosted rendezvous: `129.213.28.18:21116`; relay host `129.213.28.18`. Matching server public key configured; copy exact verified key to mobile RustDesk rather than guessing.
- The previous setting was `verification-method=use-permanent-password`, which **rejects the one-time password the operator attempted**. Changed to `verification-method=use-both-passwords` plus `approve-mode=password`, keeping existing permanent-password material untouched.
- Before modifying, RustDesk2.toml was backed up locally under `~/.local/state/kali-novnc/` with mode 0600.
- Only the RustDesk GUI process was restarted (not the desktop or VNC); restarted client resolved the same device ID and re-established an ESTABLISHED TCP session with the rendezvous server at port 21116.
- Idempotent GUI-autostart wrapper created at `~/.local/bin/ensure-kali-rustdesk.sh`, XFCE autostart `~/.config/autostart/kali-rustdesk.desktop`. **Not equivalent to a root-installed system RustDesk service**; pre-login / reboot-unattended behavior remains unverified.
- **Android RustDesk login is not yet proven.** On Android, configure identical ID/relay/key, connect to the Kali RustDesk ID shown in its GUI, choose the one-time or an explicitly set permanent password, then verify keyboard, mouse, clipboard, reconnect and reboot behavior. Treat a TCP connection to the rendezvous server as *not sufficient* proof.

## Direct-IP ingress: remaining blocker

The operator explicitly requires IP-based HTTPS/noVNC, not a Cloudflare Quick Tunnel. Current guest does not own the public IP and cannot bind 129.213.28.18:443. The public IP's port 80 is already occupied by an existing nginx. Before making changes:

1. Obtain authorized OCI **host** console/SSH or host-level orchestrator access, and capture live host's IP, listening ports, nginx config, port forwarding, OCI NSG/security lists and restore point.
2. Confirm association of the host/public IP with this `10.42.1.26` guest and verify stable guest routing or a service DNS.
3. Provision a **distinct, authenticated TLS reverse-proxy listener** with WebSocket Upgrade/Connection support and valid browser-trusted certificate for the IP address (or use a private authenticated VPN with its IP). Do not publish bare RFB 5901/5902 or plaintext credentials.
4. Verify direct-IP URL from physical Android: HTTP page, HTTPS trust, authenticated `wss://`, RFB login, input, reconnect and workstation restart. Disable Quick Tunnel only after full acceptance.
5. Do not overwrite the separate protected Helix/OmniKali ingress contracts to satisfy this request.

## Test record / outstanding risk

| Capability | Evidence |
|---|---|
| X display and desktop alive | PASS |
| Fixed 1280×720 landscape resolution | PASS at host XRandR |
| Browser noVNC code syntax and HTTP assets | PASS |
| Mobile zoom controls | CODE PRESENT; Android acceptance pending |
| RustDesk app 1.4.9 launched | PASS |
| RustDesk self-hosted server connectivity | TCP ESTABLISHED; mobile acceptance pending |
| RustDesk one-time+permanent config | File modified and GUI relaunched; phone acceptance pending |
| Permanent direct-IP HTTPS/noVNC | **BLOCKED by missing host-level ingress access** |
| Reboot recovery | NOT PROVEN |
| Separate offline Grasshopper workstation | NOT RECOVERED |

**Safety rule:** Verify deployment boundary and restore points before any host-level ingress change, and never commit tokens, passwords or private RustDesk TOML files.

### Later live findings (same maintenance session)

- Native **landscape XRandR 1280×720** remained active; original 411×788 portrait was reproduced earlier and is no longer the selected mode.
- `~/.local/opt/noVNC/mobile.html` is an additional phone-friendly viewer with **Zoom − / Zoom + / Fit / Pan / Fullscreen/Rotate** controls. The HTML, inline JS syntax and local HTTP 200 were checked, **but real Android gesture/click coordinate acceptance is still pending**. The standard `vnc.html` also has a conditional top-level zoom toolbar; the duplicate toolbar is hidden when inside the mobile iframe.
- A **private IP-bound** authenticated gateway was also discovered at `10.42.1.26:6082` (HTTP 200 at `/login`, unauthenticated `/vnc.html` redirects). Its tmux service name is `kali-private-web`. The initiator of this extra process was not established; do not confuse it with a verified public ingress or create duplicate bindings. Public `129.213.28.18` still has an unrelated nginx listener on port 80, and its relation to the guest must be established via OCI host controls before proxy modification.
- After restarting only the RustDesk GUI, RustDesk 1.4.9 retained its ID and showed an ESTABLISHED TCP session to self-hosted `129.213.28.18:21116`. TCP probes of ports 21115, 21116 and 21117 all succeeded. Settings `verification-method=use-both-passwords` and `approve-mode=password` remained on disk. Android-to-Kali RustDesk connection and credential acceptance are still **NOT PROVEN**.
- **Direct public-IP TLS is technically possible without a domain** using publicly trusted short-lived Let's Encrypt IP address certificates (available since 2026-01). Certbot >=5.4 supports IP issuance. The certificates last about 160 hours and require automatic renewal; host-level HTTP-01 validation on the existing port 80 and nginx WebSocket forwarding to the private gateway must be configured **only by an authorized OCI host administrator**. Do not install self-signed WSS or change existing host ingress blindly.
- RustDesk's existing `verification-method=use-permanent-password` was the likely reason a mobile user attempting a *one-time* password was rejected; this is a configuration diagnosis, not evidence that Android login now succeeds.
