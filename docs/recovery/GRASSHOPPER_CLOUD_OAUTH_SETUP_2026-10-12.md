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
