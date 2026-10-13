# Cloudflare Workers — Free Edge API and Lightweight MCP Routing

**Status: candidate, Free account needs verification.** Cloudflare Workers Free supports **100,000 requests/day** and **10 milliseconds CPU per invocation**; current memory cap is 128 MB. It is not a VM, and cannot run a full Kali desktop or Android guest. Additional products (KV, Durable Objects, D1, R2, DNS/domain) have different quotas and billing—do not enable them without a separate review.

Sources: https://developers.cloudflare.com/workers/platform/pricing/ ; https://developers.cloudflare.com/workers/platform/limits/ ; https://developers.cloudflare.com/workers/get-started/guide/

## Step-by-step

1. On Android or browser open https://dash.cloudflare.com and log in directly to Cloudflare. Check **Workers & Pages → Plan** and confirm `Free` (not Paid); review request/CPU quotas. If signup asks for a paid upgrade, decline.
2. On an existing Node.js environment (Grasshopper or a trusted device), check Node support and use Cloudflare's documented CLI in a **new project directory on existing data storage**, not the nearly-full OCI root. No global install required:
   ```bash
   node --version
   npx wrangler --version
   npx wrangler login
   npx wrangler whoami
   ```
   `npx` may fetch packages from npm; inspect versions and network permissions first. The browser login is directly with Cloudflare and credentials remain in Wrangler's configured store.
3. Develop locally only (`npx wrangler dev`) with a simple `GET /health` returning a small JSON status. Do not expose host system commands, OAuth callbacks or secret-bearing logs. Bind local test service to loopback.
4. Before deploying, check project is in the Free plan, request quota not shared by other Workers, CPU <10ms per request, and any bundled services/analytics/storage are in their respective free allowances. Do not assume a Workers invocation can proxy a high-volume video stream without resource/network implications.
5. After **separate operator approval and verified free plan**, you may use Cloudflare's own Deploy UI or `npx wrangler deploy` for a small Workers Free endpoint. Validate `*.workers.dev` domain, HTTPS, resource usage, rate limits and error behavior. **Deployment is not part of workerctl v0.**
6. Never use an unauthenticated Worker as an Internet-exposed shell, RustDesk relay, or all-purpose MCP gateway. An MCP edge gateway needs OAuth 2.1/PKCE, signed device scopes, authorization and upstream-origin validation before public access.

## Zero-billable controls

Use **Workers Free** not Paid, limit event rate, configure fail-closed behavior for security-sensitive routes, avoid paid bindings and plans. If quotas change, the CLI should return `NEEDS_FREE_ENTITLEMENT_VERIFICATION`. One-time per-account Cloudflare login can be reused by Wrangler but is **not** a universal login for GCP/OCI.
