# Troubleshooting, Security Incidents, and Recovery

| Symptom | Diagnosis | Non-destructive remedy |
|---|---|---|
| `gcloud` lists projects, ADC missing | CLI OAuth and ADC are separate | `gcloud auth application-default login` locally; do not copy credential JSON to CI |
| GCP project billing disabled | Cannot deploy `e2-micro` with current project | Do not enable billing under zero-billable rule; use GitHub Actions instead |
| OCI security token expired | OCI browser sessions default ~60 minutes | `oci session authenticate --region <home-region> --profile-name <existing-profile>` in browser; `oci session refresh --profile ...` within supported validity window |
| OCI CLI list exits 0 but prints nothing | Oracle CLI can omit output for empty lists | Verify through Python SDK before treating as error; no need to create resources |
| OCI reports tens of free "available" A1 cores | Service limits != Always Free entitlement | Count free OCPU-hours/GB-hours and all active instances; never allocate based only on service quota |
| Azure VM size isn't available in selected region | Subscription/zone restrictions | `az vm list-skus --location eastus --size Standard_B1s --all -o table`; don't substitute a paid SKU |
| AWS CLI login requires access portal | Identity Center not yet configured | Configure `aws configure sso --use-device-code` for existing Identity Center; use provider page for first setup |
| IBM SSO works, costs uncertain | PAYG with free tier is not capped at $0 | Treat as discovery-only until enforceable cap verified |
| Render free instance "disappeared" | Spin down after ~15 minutes; ephemeral local storage | Use only disposable test app, store state elsewhere within verified free tier |
| GitHub Actions unavailable in UI | `workflow_dispatch` file absent from default branch or Actions disabled | Commit workflow to default branch, enable Actions, use public repo standard runner |
| User has to authenticate twice | Provider user CLI credential and workload/SDK credential are distinct | Show precise purpose and scopes; never capture passwords for reuse |
| Action asks for card details in workflow | Security incident / phishing risk | Abort. Use only official vendor billing UI, never paste card numbers/CVV into CI or chat |
| New resource could exceed quota/cost | Unverified eligibility | Deny provisioning. Record missing data and next manual action |
| Android Termux cannot run vendor CLI | Unsupported architecture/CLI packaging | Use phone browser + official cloud CLI on existing OCI VM, or protected CI discovery only |
| Public OAuth callback won't reach phone | Headless flow chosen despite a desktop/browser | Use provider CLI in graphical desktop, or documented device-code flow; no VNC HTTP for secrets |

## Recovery procedure

1. Stop new plan submissions, do not tear down existing RustDesk/noVNC/QEMU.
2. Read private local state/report and a sanitized GitHub operations journal; do not fetch user secrets into chat.
3. Run `python3 worker-network/workerctl.py plan --providers all` to regenerate the **non-mutating** current catalog.
4. Run `verify` locally for accessible CLIs. Identity PASS is not pricing PASS.
5. If a provider detects a billable service, stop, revoke the provisioning scope, and use that provider's dashboard to inspect/decommission only with operator approval and verified backups.
6. Record precise code revision, region, account alias, resource IDs privately, API statuses, and billing status without exposing tokens.

## Reporting format

`STAGE [n/total] %-complete elapsed API-calls verified-empty errors` followed by final `PASS_READ_ONLY`, `NEEDS_USER_AUTH`, `BLOCKED_COST`, or `FAILED_VALIDATION`. In CI emit newline events for accessible logs; on Termux a non-flashing status spinner is optional. Never claim success for unrun OAuth or external billing setup.
