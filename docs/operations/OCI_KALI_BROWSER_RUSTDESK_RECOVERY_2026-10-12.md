# OCI Kali workstation — live browser/RustDesk recovery record

**Evidence captured:** 2026-10-12 (EDT), via authenticated Remote Desktop Commander execution on `kali-workstation`.
**Status:** Partial. Browser access through temporary tunnel was observed by the operator; direct-IP HTTPS access and RustDesk remote-login acceptance are **NOT PROVEN**.

## Authority and separation
- This is the live **OCI Kali container/workstation**, not proof of access to the separate `grasshopper-workstation` instance.
- The Kali guest has private address `10.42.1.26` on a separate container network. Its outward public address belongs to an upstream OCI host. Do not assume services bound on guest loopback are public-IP accessible.
- An existing upstream host nginx on HTTP port 80 serves **another** noVNC frontend and a WebSocket/RFB endpoint. Its VNC target was NOT proven to be this guest. Do not repoint or replace its routing without identifying its owner.
- Preserve the upstream host's RustDesk rendezvous/relay services and other tenants. No AWS migration.
- Preserve the original Kali XFCE/Xtigervnc session (display `:1`, port 5901). Its password file is a **read-only bind mount** from an upstream persistent volume; changing it inside the container failed. Do not retry or restart the original display to force a password change.

## Known live components
- `Xtigervnc` process, XFCE session/window manager, `DISPLAY=:1`.
- Physical X display was **411x788 portrait** due to remote resize, restored to **1280x720 landscape** via `xrandr`. UI link should use `#resize=scale&view_clip=0`, NOT `resize=remote`. This prevents noVNC from resizing the remote desktop to a portrait phone viewport.
- `~/.local/opt/noVNC`: noVNC v1.7.0, websockify v0.13.0.
- `~/.local/opt/noVNC/mobile.html`: mobile browser wrapper with Fit, + / − zoom, Pan mode, optional fullscreen / landscape orientation request. It embeds standard noVNC; Android browser interaction requires fresh acceptance.
- `~/.local/opt/x11vnc`: x11vnc 0.9.17 from extracted Kali ARM64 packages (no global apt modification). Mirrors the original display on loopback TCP 5902 using a separate writable file `~/.local/state/kali-novnc/x11vnc-password`, mode 0600.
- Local WebSockets bridge on 127.0.0.1:6080 proxies port 5902.
- Local password/cookie gateway `~/.local/bin/kali-novnc-auth.py` on 127.0.0.1:6081. It is the only origin exposed by temporary HTTPS tunnel; do not expose 6080 or raw VNC on a public port.
- `~/.local/bin/ensure-kali-novnc.sh` and XFCE autostart `~/.config/autostart/kali-novnc.desktop` start tmux services. Reboot survival unverified.
- The temporary Cloudflare Quick Tunnel is a fallback ONLY. It has no stable hostname or SLA. The protected `--allowed-mail` Quick Tunnel failed after email OTP, possibly related to upstream session/cookie behavior; a second locally authenticated gateway was installed. **Do not promote the temporary Quick Tunnel to a permanent address.**

## RustDesk live findings
- An existing RustDesk **portable AppImage v1.4.9** is running as the Kali user (not as a boot-managed native service), from `~/.local/opt/rustdesk-1.4.9/AppRun`.
- The device's RustDesk ID was confirmed through `AppRun --get-id`. It and the upstream server public key should not be committed to this public repository.
- `~/.config/rustdesk/RustDesk2.toml` selects a custom rendezvous/relay server on the OCI host and `verification-method=use-permanent-password`.
- TCP rendezvous/relay ports 21115, 21116, 21117 responded from the guest. Client logs show repeated timeouts contacting the optional HTTP API on port 21114 and inbound mobile relay attempts that closed. These observations do **not** prove a valid RustDesk password or that the Android client used the matching server key.
- `~/.local/bin/change-kali-rustdesk-password` provides a local **interactive** password rotation path using RustDesk's documented `AppRun --password` CLI; remote acceptance still must be tested.
- `~/.local/bin/ensure-kali-rustdesk.sh` and `~/.config/autostart/kali-rustdesk.desktop` supervise the existing portable client at XFCE startup. This is **not** equivalent to a native systemd service or pre-login access; reboot survival unverified.

## Acceptance: strictly separate PASS vs NOT PROVEN
**Observed PASS**: RDC command execution in guest; XFCE active; direct local WebSocket 101 and RFB greeting; temporary public HTTPS gateway login/cookie and authenticated WSS 101 + RFB greeting; operator confirmed browser desktop access; guest xrandr 1280x720; static `mobile.html` returns HTTP 200 from local websockify; RustDesk CLI --get-id; upstream server TCP ports 21115–21117.

**NOT PROVEN**: operator's new mobile wrapper interaction/zoom; RustDesk Android app login after rotation; permanent HTTPS with OCI public IP and valid TLS; guest mapping from public host port 80; secure host nginx reverse proxy; RustDesk native service at reboot; original Grasshopper host recovery.

## Next work in order
1. Obtain authorized upstream OCI host access through the user's authenticated OCI control plane, and inspect nginx config and the actual upstream noVNC endpoint without modifying other workloads.
2. Expose authenticated guest gateway via a narrowly scoped private network route from upstream host, terminate TLS with a trusted certificate (dedicated direct-IP certificate or DNS A/sslip.io hostname pointing directly to the OCI public IP; **not** a Quick Tunnel), and restrict ingress via OCI network security group/firewall. Never advise entering remote desktop credentials over plaintext Internet HTTP.
3. Confirm Android mobile wrapper zoom, touch, keyboard, and reconnect without changing X display to portrait.
4. Use the interactive RustDesk password setter, match the host public key/ID server/relay on the Android RustDesk client, and prove an authenticated real session.
5. Rotate any temporary credentials, validate restart/reboot, and write a fresh acceptance log. No claim of production readiness until all acceptance steps pass.

## Source rules
Fresh live observation > explicit acceptance proof > source implementation > public README historical claims. No passwords, API tokens, SSH keys or RustDesk private key material in Git.
