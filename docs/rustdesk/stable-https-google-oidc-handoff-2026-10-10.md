# RustDesk Console Stable HTTPS and Google OIDC Handoff

Date: 2026-10-10  
Status: **IN PROGRESS / NOT YET PRODUCTION VERIFIED**

## Objective

Provide a free, stable HTTPS origin for the self-hosted RustDesk Console on the Grasshopper OCI host, then complete Google OpenID Connect (OIDC) sign-in and device assignment for Grasshopper and Kali.

## Evidence collected through Remote Desktop Commander

- Host: Oracle Linux Server 9.8, host name `grasshopper-workstation`.
- Existing public Grasshopper noVNC URL: `http://129.213.28.18/vnc.html?autoconnect=true&resize=scale&reconnect=true`.
- Existing Nginx default server is configured as `/etc/nginx/conf.d/grasshopper.conf`, listens on port 80, and proxies all default-host paths to `127.0.0.1:6080`.
- RustDesk Console config: `/srv/grasshopper/rustdesk-console/conf/config.yaml`.
- Console API responds locally at `http://127.0.0.1:21114`; `/_admin/` returned HTTP 200 and the earlier health check returned HTTP 200.
- RustDesk Console configuration advertises `rustdesk.api-server: http://127.0.0.1:21114`, which is unsuitable for remote clients and OIDC callback routing.
- Listening ports include 80, 21114-21119; 443 was not listening when inspected.
- Several `cloudflared tunnel --url` processes exist for local services. These are quick tunnels and do not provide a durable hostname across process restarts.
- `https://129-213-28-18.nip.io` timed out during inspection because there was no working HTTPS listener yet. The HTTP hostname `http://129-213-28-18.nip.io` reached the existing Nginx server and returned HTTP 200.
- Google Cloud CLI browser authentication was reported successful by the operator. An active CLI account does not by itself prove an OAuth web client exists or that the account can create one.

## Proposed free hostname

Candidate: `129-213-28-18.nip.io`

This is a free IP-derived DNS hostname and requires no domain purchase. It is only truly persistent if the OCI public IP remains fixed. Before production, verify that `129.213.28.18` is a reserved public IP or otherwise guaranteed not to change. If not, allocate/associate an OCI reserved public IP (subject to OCI account permissions) or use a free managed DNS provider with an owned hostname.

Planned console origin:
- `https://129-213-28-18.nip.io/`
- Google OIDC callback: `https://129-213-28-18.nip.io/api/oidc/callback`

Do not register the callback with Google until the HTTPS origin and certificate have been externally verified.

## Prepared host setup script

Remote Desktop Commander wrote the candidate script to:

`/home/grasshopper/rustdesk-console-https.sh`

It passed `bash -n` syntax validation. It is intentionally not reported as deployed: the remote command policy blocked privileged operations such as `sudo nginx -T` and `sudo -n -l`. Therefore, it has not changed Nginx, installed Certbot, issued a certificate, opened port 443, or modified the running console. An authorized root execution is still required. Review the script before execution, then run:

```bash
sudo bash /home/grasshopper/rustdesk-console-https.sh
```

The script uses a dedicated Nginx virtual host for the candidate hostname to avoid replacing the default noVNC virtual host. It backs up relevant Nginx config before changing it and requests a Let's Encrypt certificate using HTTP-01. If certificate issuance fails, it attempts to restore the prior Nginx config. The host firewall may need TCP/443 opened. OCI NSG/security-list ingress must also allow TCP/443; host firewall changes alone are not sufficient.

**Review note:** Check that Certbot is available from enabled Oracle Linux repositories before relying on the script. If package installation fails, enable an appropriate trusted repository or use another supported ACME client. Do not disable TLS validation or expose the console over plain HTTP as a workaround.

## Required remaining work

1. Verify public IP assignment type and confirm the hostname remains stable across instance stop/start.
2. Review and run the HTTPS setup script with root privileges.
3. Add OCI network ingress for TCP/443 if absent, preserving all existing security rules.
4. Verify externally: HTTP-01 challenge, valid TLS chain, HTTPS health endpoint, and the OIDC callback route.
5. Update RustDesk Console `rustdesk.api-server` from loopback HTTP to the public HTTPS origin, back up the config first, and restart the correct console service.
6. Set and verify a strong Console administrator password before public exposure. Avoid exposing the administration UI without authentication.
7. Register a Google OAuth web client in the correct Google Cloud project. Set the exact authorized redirect URI to `https://129-213-28-18.nip.io/api/oidc/callback`. Store client secret in a protected secret store/environment/config, never in Git.
8. Configure OIDC in the installed Console version and verify first-login account creation if supported.
9. Configure RustDesk client server settings and authorized device assignments for both workstations.
10. Test from an external network and Android: Google sign-in, session persistence, device listing/assignment, unattended connection to Grasshopper and Kali, relay connectivity, and reboot persistence.
11. Record actual results and logs here. Use PASS only when supported by evidence.

## Important architecture distinction

Google Cloud CLI authentication, RustDesk Console OIDC login, and RustDesk unattended remote access are separate authentication layers. Completing the first does not automatically complete the latter two. Standard RustDesk clients do not automatically gain access to devices merely because the user signed into Google; client configuration, device authorization, and unattended-access policy still need validation.

## Current acceptance status

- [x] Local RustDesk Console API responds.
- [x] Existing noVNC endpoint still responds over HTTP at inspection time.
- [x] Candidate free hostname resolves/routes to the current Nginx HTTP server.
- [x] HTTPS setup script written to host and shell syntax checked.
- [ ] Stable/reserved public IP verified.
- [ ] HTTPS certificate issued and externally validated.
- [ ] Public TCP/443 reachability verified.
- [ ] Console API origin updated to HTTPS.
- [ ] Google OAuth client registered and OIDC configured.
- [ ] Google login tested end to end.
- [ ] Both workstation connections tested end to end.
