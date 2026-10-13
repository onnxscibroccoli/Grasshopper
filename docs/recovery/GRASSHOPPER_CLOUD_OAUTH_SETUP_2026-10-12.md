# Grasshopper cloud development authentication — 2026-10-12 EDT

## Scope and confirmed live state

**Workstation:** `grasshopper-workstation`, Remote Desktop Commander device `0852e6f4-2507-4d0f-9d62-f6eda8cdd169` **ONLINE** at live audit. Earlier disconnected RDC registration `4d7e251b-1075-48fa-bfa0-5efa40fe6d14` is historical. Do not mistake the two device registrations.

**Host:** Oracle Linux 9.8, ARM64/aarch64; user `grasshopper`; systemd PID 1; root filesystem 30 GiB total, 28 GiB used, 2.1 GiB free (**94% usage**). This host runs the existing public nginx ports 80/443, local noVNC/websockify and other development processes. **No services were restarted and no environment was reinstalled** during this authentication stage.

- Oracle CLI: **3.94.1**, executable `~/.local/bin/oci`; `~/.oci/config` (0600) already has profile **`OMNIKALI`**, region `us-ashburn-1`, existing key and security-token files present. The existing token is **expired/unvalidated** at last live probe.
- Google Cloud SDK: **588.0.0**, executable `~/.local/bin/gcloud`, existing CLI OAuth **PASS** with read-only `gcloud projects describe omnikali` and `gcloud projects list`. Google **Application Default Credentials (ADC) missing**; no `~/.config/gcloud/application_default_credentials.json`.
- Default `gcloud` project is unset; there is no need to change it to use CLI authentication. The bootstrap proposes **`omnikali`** as ADC's quota/billing project when completed; permission and cost implications apply.
- Existing graphical desktop has Xvnc `:1` and XFCE but RDC commands may not inherit graphical display; use a desktop terminal.
- **Security:** The user-confirmed `http://129.213.28.18/vnc.html` works but is plaintext HTTP. Avoid transmitting OAuth bootstrap results, PINs, passwords or session tokens over it. Host nginx has a locally verified HTTPS endpoint with a trusted certificate for the DNS name `129-213-28-18.nip.io` (SAN), NOT the raw IP: local probe of `https://129-213-28-18.nip.io/vnc.html` returned HTTP 200 with certificate validation via `--resolve`. Public/mobile accessibility has not yet been verified. Prefer secure HTTPS or approved encrypted RDC/SSH for OAuth.

## Bootstrap installed and initiated

Script deployed (mode 0700) to `/home/grasshopper/.local/bin/grasshopper-cloud-auth.sh` and versioned in this repository at [scripts/cloud/grasshopper-cloud-auth.sh](../../scripts/cloud/grasshopper-cloud-auth.sh).

Live Bash syntax test: **PASS**. Read-only `status` test:
```text
GCLOUD_API=PASS
GOOGLE_ADC=MISSING_OR_INVALID
OCI_OMNIKALI=EXPIRED_OR_INVALID
```

Detached, interactive tmux session **`grasshopper-cloud-oauth`** was started with `grasshopper-cloud-auth.sh all`.

**Current OAuth stage:** Existing Google CLI API PASS, paused at `gcloud auth application-default login --no-browser --project=omnikali` waiting for the user to complete Google's `--remote-bootstrap` flow from the physical Android's already installed gcloud CLI and Chrome browser. Do not copy authentication URLs or the remote-bootstrap command into public GitHub or this journal.

**Operator steps:**
1. Use a secure authenticated Grasshopper terminal, enter `tmux attach -t grasshopper-cloud-oauth`. Attach from one terminal only.
2. The pane displays Google's `gcloud auth application-default login --remote-bootstrap="..."` command. Copy the full command to **Termux on the physical Android**, whose Google Cloud CLI is already installed.
3. Complete Google's browser OAuth **on the phone using HTTPS**, then paste the one-time returned bootstrap result into the waiting Grasshopper terminal. Do not send it through chat.
4. The same running script then attempts Oracle `OMNIKALI` session OAuth via `oci session authenticate --no-browser --region us-ashburn-1 --profile-name OMNIKALI --config-location ~/.oci/config`. Follow the printed OCI instructions on the trusted phone browser. The pre-existing `~/.oci` directory will first be privately backed up under `~/.local/state/grasshopper-cloud-auth/`.
5. Verify `grasshopper-cloud-auth.sh status` returns `GCLOUD_API=PASS`, `GOOGLE_ADC=PASS`, `OCI_OMNIKALI=PASS`. Only after this state can remote SDK/cloud tools be declared authenticated.

**Useful scripts:** `grasshopper-cloud-auth.sh status|google|oci|all`. Safe timestamped non-token status journal: `~/.local/state/grasshopper-cloud-auth/last-status.txt`. Do not commit `~/.oci`, Google Cloud credentials, tmux pane contents, or session token files.

## Next steps after success

1. Query OCI instance, boot/data volume and lifecycle state read-only and reconcile with physical Android results. Measure workstation compute/disk load before any migration.
2. Inspect existing RustDesk binaries/configuration, rendezvous/relay, graphical session persistence and authorized user credentials; accept one-time or permanent password with on-device functional proof. Investigate any existing Google OAuth integration in repository and deployed services; do **not** assume native RustDesk client supports Google OAuth directly.
3. Verify browser/agent tooling used for Antigravity; **Google Cloud SDK OAuth is not automatically Google Antigravity login or API authorization**. Evaluate the separately configured Antigravity/OpenCode plugin after cloud CLI/ADC PASS.
4. Keep Kali and existing Grasshopper web VNC routes unchanged until independent recovery channels are tested.
5. Track decisions and evidence chronologically in the cross-project knowledge-graph operations journal.

**Authentication context:** OCI interactive security-token sessions default to approximately **60-minute validity**; persistent unattended agents require separate authorized service/workload identity planning, not reused human tokens.

No cloud resource modifications, password changes, or service restarts were performed by the bootstrap setup.

## Corrective implementation: browser OAuth + RustDesk client (2026-10-12, ~23:30 EDT)

**Previous implementation failed operator acceptance.** The previously documented `grasshopper-cloud-auth.sh all` used `--no-browser` and a one-shot `tmux` login session that exited on failure. It did not meet the requirement to use the **already working local noVNC desktop and Firefox**. The HTTPS URL `https://129-213-28-18.nip.io/vnc.html` had a **locally valid certificate but did not load on the operator's phone**. Local HTTPS success is not proof of externally accessible browser entry. Do not present that URL as working.

### Replacement installed and started through RDC

- **New canonical launcher** `~/.local/bin/grasshopper-cloud-browser-login.sh` and [source](../../scripts/cloud/grasshopper-cloud-browser-login.sh). Bash syntax PASS; X11 `DISPLAY=:1` with `~/.Xauthority` validated via `xset`; Xfce terminal launched successfully. No headless OAuth options used.
- Persistent visible desktop terminal title: **Grasshopper Cloud Browser OAuth**. The script automatically attempts Google OAuth via `gcloud auth application-default login --project=omnikali`, opening Firefox and a local callback listener on **127.0.0.1:8085**; read-only process/listener validation PASS. **Google ADC sign-in is still pending operator browser interaction**, not yet PASS.
- On successful Google authentication, script proceeds to `oci session authenticate --region us-ashburn-1 --profile-name OMNIKALI --config-location ~/.oci/config`, also with browser OAuth (not `--no-browser`). Backups of prior OCI config are local, private. **OCI authentication remains pending**, do not claim success.
- **Resilience:** The new launcher stays open on errors and offers a persistent menu: 1 Google, 2 Oracle, 3 status, 4 retry both, 5 open Firefox, 0 exit. This eliminates the one-shot tmux issue. The old script/source is superseded; agents should use the browser-login launcher.
- Existing Google CLI auth to `omnikali` remains PASS. Browser auth and validated ADC are distinct.
- Avoid sharing browser OAuth URLs/callbacks or tokens in GitHub/chat, and avoid entering credentials via unsecured `http://129.213.28.18/vnc.html` when a secure operator control path is available.

### RustDesk restoration completed on Grasshopper, operator-password handoff

- Server already running on this Oracle host: RustDesk rendezvous `hbbs`, relay `hbbr` and console; these processes/services were NOT restarted.
- Found existing `~/.config/rustdesk/RustDesk2.toml` user configuration pointing to `129.213.28.18` as custom rendezvous and relay, with **the exact same server public-key SHA256 fingerprint** as Kali's working client (`b25aff7df410e8591c515262836577e3e042939d6c2bdf44a5701b0aeb9db6b2`). No private server keys copied or modified.
- User-level RustDesk client was absent. Downloaded official RustDesk 1.4.9 **ARM64 RPM**, validated SHA256 `3e523df7ceb6f3804b047a3cac797354c4bf46ec19f2d7ff5e198787003cb092` against the official release, extracted **rootlessly** under `~/.local/opt/rustdesk-1.4.9` without installing or replacing server RPM/system packages. Client binary `--version` returned **1.4.9**.
- Prior `RustDesk2.toml` backed up mode 0600; verified configuration now allows `verification-method='use-both-passwords'` and `approve-mode='password'`. Existing host/relay/key retained.
- Client GUI started on X11 `:1`; live process `rustdesk` found and Flutter window activity logged. Client ID via official CLI `--get-id`: **386544245** (**Grasshopper**, not Kali's **218812001**).
- [Rootless restart supervisor](../../scripts/remote/grasshopper-rustdesk-supervisor.sh) installed at `~/.local/bin/grasshopper-rustdesk-supervisor.sh` and running. XFCE autostart `~/.config/autostart/grasshopper-rustdesk.desktop` configured for graphical-session persistence. Full OCI host reboot recovery and Android-to-Grasshopper RustDesk session **not yet verified**.
- **User action:** Open the already visible RustDesk window; configure a private *permanent password* in RustDesk Security settings. **No password was generated, transmitted or committed.** Test Android RustDesk connectivity to **386544245**, optionally test one-time password and reconnect. Active client configuration already matches Kali's working server, but connectivity/authentication from Android is acceptance pending.

**Important distinction:** Corrected **launchers and GUI/client state PASS**, actual Google ADC/OCI OAuth completion and Android RustDesk connection **PENDING**. The existing browser noVNC and production QEMU/RustDesk server were preserved.
