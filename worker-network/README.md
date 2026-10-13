# Workerctl — Android-first zero-billable onboarding tool

This is the **non-mutating v0** of the multi-cloud onboarding automation. Read the full [provider handbook](../docs/worker-network/README.md), [auth/payment safety](../docs/worker-network/AUTH_AND_BILLING.md), and [automation roadmap](../docs/worker-network/AUTOMATION_DESIGN.md).

```sh
python3 worker-network/workerctl.py catalog
python3 worker-network/workerctl.py wizard
python3 worker-network/workerctl.py plan --providers oci,gcp,github
python3 worker-network/workerctl.py onboard --providers oci,gcp,github --output "$HOME/worker-plan-001.json"
python3 worker-network/workerctl.py status --file "$HOME/worker-plan-001.json"
python3 worker-network/workerctl.py resume --file "$HOME/worker-plan-001.json"
python3 worker-network/workerctl.py handoff --provider gcp
python3 worker-network/workerctl.py verify --providers oci,gcp,github
# Only from a PRIVATE, INTERACTIVE terminal on phone/desktop, never CI:
python3 worker-network/workerctl.py auth --provider azure
```

**Never shares passwords, OAuth responses, refresh tokens or credit cards.** An official cloud CLI authentication is executed in the current terminal when explicitly requested, and may open the official provider browser. The `verify` operation suppresses cloud CLI output and returns only probe statuses. It cannot prove a resource is free. Use provider billing consoles to check eligibility; no deployment code exists.

```sh
python3 -m unittest discover -s worker-network/tests -v
```

The `catalog.json` registry defines eight vendors, their published candidate types, provider consoles, native auth steps, and fail-closed risk status. Because new providers can change terms without notice, each must be reverified before any future deployment adapter can be allowed.
