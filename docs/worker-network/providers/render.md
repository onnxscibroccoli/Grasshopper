# Render — Free Sleeping Web-Service Test Worker

**Status: candidate only; not suitable as a persistent Android or Kali VM.** Render Free web services spin down after about **15 minutes of inactivity** and can take time to wake. Free filesystem contents are ephemeral. The Free tier currently allocates **750 instance-hours per workspace per calendar month**; builds, bandwidth and service traffic count against other limits. If a payment method is attached, exceeding included bandwidth/build usage **can incur a charge**. Prefer an account **without a payment method** and use only disposable web demos.

Official: https://render.com/docs/free ; https://render.com/docs/your-first-deploy ; https://render.com/docs/faq

## Step-by-step

1. Sign in to https://dashboard.render.com with the provider's own browser flow (Render supports GitHub authorization). Review the scope of GitHub access carefully; prefer access to an individual demo repository, **not** all private repos.
2. Inspect Workspace → Billing/Included Usage: ensure plan is Free, no payment method or paid workspace plan, monthly bandwidth/build minutes within limits. **Do not add a card for automation.**
3. Prepare a public repository with a trivial `/health` HTTP endpoint that reads no environment secrets and retains no local state. Choose one service; do not duplicate across regions for extra free hours.
4. Dashboard → New → Web Service → select limited-scope repository → Instance type **Free**, default start command and only a tiny build. Stop if the dashboard changes proposed service to paid or introduces paid storage/database/add-ons.
5. Deploy only after separate manual free verification. Verify generated HTTPS service URL and response; intentionally allow sleep/restart and ensure application recovers without persistent local filesystem. Store zero secrets in URL or job output.
6. Observe included monthly instance hours, bandwidth, build minutes and project sleep behavior. If bandwidth/usage crosses a threshold or spend control is missing, disable service rather than rely on email notices. Do not expose web-shell / remote exec.
7. Clean up all demo services when finished; if trying to create an always-on MCP server, use OCI existing A1 private service instead.

Render Free is for staging **stateless** service prototypes, not a remote workstation. Handoff and billing must remain within Render's official UI; there is no shared cross-cloud card vault or permanent universal user token.
