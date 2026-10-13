# Human-Action Handoff Queue — Tested Offline Prototype

**Objective:** When an agent reaches an account login, OAuth, signup, MFA, user consent, provider-native billing review or account-export step, it must **pause** and create a durable, non-secret user-action ticket. The user can return after visiting the official website; the system must not mistake user acknowledgement for confirmed technical authentication.

## What is working

`python3 worker-network/handoffctl.py` is a Python standard-library CLI implementing a local SQLite queue (0600 database), vendor login origin allowlist, expiring tickets (60–3,600s), idempotency keys, manual acknowledgement, recovery/retry and an event journal. It performs **no provider API calls**, website automation, notifications, noVNC hosting, public listener, token storage or cloud resource mutations.

User acknowledgement advances only to **`AWAITING_VERIFICATION`**, never directly to `AUTH_VERIFIED` or `DEPLOYED`. An actual adapter will later verify login via official API or permitted authenticated UI. No trusted identity proof exists in this local CLI: a local TTY confirmation is a demonstration, not a cryptographic owner login. The Android companion and secure OIDC gateway are future work.

## Run on Termux or Grasshopper

```bash
cd ~/Grasshopper # or a NEW non-disruptive checkout containing worker-network/
python3 -m unittest discover -s worker-network/tests -v

python3 worker-network/handoffctl.py create \
  --provider chatgpt \
  --action data_export \
  --origin https://chatgpt.com \
  --instruction "Request your data export using Data Controls" \
  --idempotency-key chatgpt-export-20261013 \
  --ttl 900

python3 worker-network/handoffctl.py list
python3 worker-network/handoffctl.py show --id YOUR_TICKET_UUID
# Only after finishing the vendor step in your own browser:
python3 worker-network/handoffctl.py confirm --id YOUR_TICKET_UUID
```

The `confirm` command works **only in a private interactive terminal**. It does not verify a vendor login or authorize any billing or cloud resource action. Requests expire and need a new ticket after expiry. Restarting the CLI or OS retains the queue.

## Security hard stops

- No OAuth callback, device login code, password, API key, card number, or browser profile in the ticket.
- The `--origin` must be a reviewed official HTTPS origin **without path/query/callback token**; adding a new vendor requires a code review of its hostname allowlist.
- Do not run the authentication process on a public GitHub-hosted Actions worker. GitHub Actions remains appropriate for the broker's **software tests**.
- Do not expose this prototype to the network or advertise a noVNC login link. The future broker needs passkey/OIDC owner identity, TLS, a session-specific viewer token behind a protected gateway, access revocation, and a separate post-login verifier.
- Google Password Manager can sync passwords/passkeys, but **do not sync an owner's entire password manager into disposable development workers**. Prefer Android-side biometric/passkey confirmation and provider-specific restricted tokens.
- No paid billing, upgrades or resource creates; see `docs/operations/FREE_ONLY_CLOUD_POLICY_2026-10-12.md`.

## Related designs

- `docs/architecture/HUMAN_HANDOFF_AGENT_CONTROL_PLANE_2026-10-13.md`
- `docs/worker-network/AUTH_AND_BILLING.md`
- `docs/worker-network/AUTOMATION_DESIGN.md`

**Next acceptance milestone:** authenticated Android notification + approved HTTPS noVNC session + independent provider-login verification + pause/resume idempotency under reconnects. This is not implemented by the local prototype.
