[Reading 317 lines from start (total: 317 lines, 0 remaining)]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

const PUBLIC = process.env.HELIX_PUBLIC_ORIGIN || "https://d22bad48irrbqe.cloudfront.net";
const RESOURCE = PUBLIC + "/mcp";
const STATE_DIR = process.env.MCP_STATE_DIR || "/var/lib/omnikali/mcp";
const FILE = STATE_DIR + "/oauth.json";
const BRIDGE_COOKIE = "helix_mcp_bridge";
const COOKIE_MAX = 1800;
mkdirSync(STATE_DIR, { recursive: true });

function envFile() {
  try { return readFileSync("/etc/helix/gateway.env", "utf8"); } catch { return ""; }
}
function envValue(name) {
  const m = envFile().match(new RegExp("^" + name + "=(.*)$", "m"));
  return m ? m[1].replace(/^"(.*)"$/, "$1") : "";
}
const COGNITO_DOMAIN = envValue("OIDC_MANAGED_DOMAIN");
const COGNITO_CLIENT_ID = envValue("OIDC_CLIENT_ID");
const COGNITO_CLIENT_SECRET = envValue("OIDC_CLIENT_SECRET");

const state = existsSync(FILE)
  ? JSON.parse(readFileSync(FILE, "utf8"))
  : { clients: {}, pending: {}, codes: {}, tokens: {}, refresh: {} };

function save() {
  writeFileSync(FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}
function id(prefix) {
  return prefix + "_" + randomBytes(24).toString("base64url");
}
function now() { return Math.floor(Date.now() / 1000); }
function json(res, status, body, headers = {}) {
  const s = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...headers });
  res.end(s);
}
function redirect(res, location, cookie = null) {
  const h = { location, "cache-control": "no-store" };
  if (cookie) h["set-cookie"] = cookie;
  res.writeHead(302, h);
  res.end();
}
function cookieClear() {
  return BRIDGE_COOKIE + "=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
function validRedirect(u) {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.hostname === "localhost" || x.hostname === "127.0.0.1" || x.hostname === "::1";
  } catch { return false; }
}
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf("="); return [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", x => chunks.push(x));
    req.on("end", () => { try { resolve(Buffer.concat(chunks).toString("utf8")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
async function cognitoToken(code) {
  const auth = Buffer.from(COGNITO_CLIENT_ID + ":" + COGNITO_CLIENT_SECRET).toString("base64");
  const r = await fetch(COGNITO_DOMAIN + "/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: "Basic " + auth },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: COGNITO_CLIENT_ID,
      code,
      redirect_uri: PUBLIC + "/auth/callback"
    })
  });
  if (!r.ok) {
    const detail = await r.text();
    const e = new Error("upstream authentication failed");
    e.stage = "cognito_token"; e.status = r.status; e.detail = detail.slice(0, 500);
    throw e;
  }
  return r.json();
}

async function userInfo(accessToken) {
  const r = await fetch(COGNITO_DOMAIN + "/oauth2/userInfo", {
    headers: { authorization: "Bearer " + accessToken }
  });
  if (!r.ok) throw new Error("upstream user lookup failed");
  return r.json();
}

function verifyPKCE(verifier, challenge) {
  if (!verifier || !challenge) return false;
  const got = createHash("sha256").update(verifier).digest("base64url");
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(challenge));
  } catch { return false; }
}

function metadata() {
  return {
    issuer: PUBLIC,
    authorization_endpoint: PUBLIC + "/mcp/oauth/authorize",
    token_endpoint: PUBLIC + "/mcp/oauth/token",
    registration_endpoint: PUBLIC + "/mcp/oauth/register",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["mcp"],
    authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: false
  };
}

export function createMcpOAuth() {
  return {
    isOAuthPath(path) {
      return path === "/.well-known/oauth-protected-resource" ||
        path === "/.well-known/oauth-authorization-server" ||
        path.startsWith("/mcp/oauth/");
    },

    async handle(req, res, url) {
      if (url.pathname === "/.well-known/oauth-protected-resource" && req.method === "GET")
        return json(res, 200, { resource: RESOURCE, authorization_servers: [PUBLIC], scopes_supported: ["mcp"] });

      if (url.pathname === "/.well-known/oauth-authorization-server" && req.method === "GET")
        return json(res, 200, metadata());

      if (url.pathname === "/mcp/oauth/register" && req.method === "POST") {
        let input;
        try { input = JSON.parse(await body(req)); } catch { return json(res, 400, { error: "invalid_client_metadata" }); }
        const redirects = Array.isArray(input.redirect_uris) ? input.redirect_uris : [];
        console.log("[omnikali-mcp] OAUTH_REGISTER_REQUEST", JSON.stringify({ts:new Date().toISOString(),redirectCount:redirects.length,redirectPrefixes:redirects.map(x=>String(x).slice(0,180))}));
        if (!redirects.length || redirects.some(x => !validRedirect(x)))
          return json(res, 400, { error: "invalid_redirect_uri" });
        const clientId = id("mcp");
        state.clients[clientId] = {
          client_id: clientId,
          client_id_issued_at: now(),
          redirect_uris: redirects,
          client_name: String(input.client_name || "MCP client").slice(0, 200),
          token_endpoint_auth_method: "none"
        };
        save();
        return json(res, 201, state.clients[clientId]);
      }
      if (url.pathname === "/mcp/oauth/authorize" && req.method === "GET") {
        const requestedClientId = url.searchParams.get("client_id") || "";
        const redirectUri = url.searchParams.get("redirect_uri") || "";
        let client = state.clients[requestedClientId];
        // Gemini can reuse a dynamically-issued client_id across authorization attempts.
        // If its registration is missing locally, recover only for our known Google redirect
        // family; PKCE and exact redirect binding are still enforced below.
        if (!client && /^mcp_[A-Za-z0-9_-]{8,}$/.test(requestedClientId) && /^https:\/\/(oauth-redirect(?:-sandbox|-test)?\.googleusercontent\.com)\//.test(redirectUri)) {
          client = { client_id: requestedClientId, client_id_issued_at: now(), redirect_uris: [redirectUri], client_name: "Gemini MCP client (recovered)", token_endpoint_auth_method: "none" };
          state.clients[requestedClientId] = client;
          save();
        }
        const responseType = url.searchParams.get("response_type");
        const challenge = url.searchParams.get("code_challenge");
        const method = url.searchParams.get("code_challenge_method");
        const scope = url.searchParams.get("scope") || "mcp";
        const oauthState = url.searchParams.get("state") || "";
        console.log("[omnikali-mcp] OAUTH_AUTHORIZE", JSON.stringify({ts:new Date().toISOString(),clientIdPrefix:requestedClientId.slice(0,16),registeredClient:Boolean(client),redirectMatch:Boolean(client && client.redirect_uris.includes(redirectUri)),redirectUriPrefix:redirectUri.slice(0,180),redirectCount:client?.redirect_uris?.length||0}));
        if (!client || !client.redirect_uris.includes(redirectUri))
          return json(res, 400, { error: "invalid_request", error_description: "unknown client or redirect_uri" });
        if (responseType !== "code" || !validRedirect(redirectUri))
          return json(res, 400, { error: "invalid_request" });
        if (!challenge || method !== "S256")
          return json(res, 400, { error: "invalid_request", error_description: "PKCE S256 is required" });
        if (scope.split(/\s+/).some(x => x !== "mcp"))
          return json(res, 400, { error: "invalid_scope" });
        if (!COGNITO_CLIENT_ID || !COGNITO_CLIENT_SECRET)
          return json(res, 503, { error: "server_configuration_error" });

        const bridgeState = id("cog");
        state.pending[bridgeState] = {
          clientId: client.client_id,
          redirectUri,
          challenge,
          scope: "mcp",
          state: oauthState,
          createdAt: now(),
          expiresAt: now() + 1800
        };
        save();

        const u = new URL(COGNITO_DOMAIN + "/oauth2/authorize");
        u.search = new URLSearchParams({
          response_type: "code",
          client_id: COGNITO_CLIENT_ID,
          redirect_uri: PUBLIC + "/auth/callback",
          scope: "openid email profile",
          state: bridgeState
        }).toString();

        const ck = BRIDGE_COOKIE + "=" + encodeURIComponent(bridgeState) +
          "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + COOKIE_MAX;
        return redirect(res, u.toString(), ck);
      }

      if (url.pathname === "/mcp/oauth/cognito-callback" && req.method === "GET") {
        const bridgeState = url.searchParams.get("state") || "";
        const p = state.pending[bridgeState];
        if (!p || p.expiresAt < now()) return json(res, 400, { error: "invalid_or_expired_state" });
        if (url.searchParams.get("error")) {
          const e = new URL(p.redirectUri);
          e.searchParams.set("error", url.searchParams.get("error"));
          if (p.state) e.searchParams.set("state", p.state);
          delete state.pending[bridgeState]; save();
          return redirect(res, e.toString(), cookieClear());
        }

        try {
          const upstream = await cognitoToken(url.searchParams.get("code") || "");
          const who = await userInfo(upstream.access_token);
          const authCode = id("code");
          state.codes[authCode] = {
            clientId: p.clientId,
            redirectUri: p.redirectUri,
            challenge: p.challenge,
            sub: String(who.sub || ""),
            email: who.email || null,
            scope: p.scope,
            expiresAt: now() + 600
          };
          delete state.pending[bridgeState];
          save();
          const out = new URL(p.redirectUri);
          out.searchParams.set("code", authCode);
          if (p.state) out.searchParams.set("state", p.state);
          return redirect(res, out.toString(), cookieClear());
        } catch (e) {
          console.error("[omnikali-mcp] OAuth upstream error", e.stage || "unknown", e.status || "", e.detail || e.message);
          return json(res, 502, {
            error: "upstream_authentication_failed",
            stage: e.stage || "unknown",
            status: e.status || null,
            detail: e.detail || e.message
          }, { "set-cookie": cookieClear() });
        }
      }
      if (url.pathname === "/mcp/oauth/token" && req.method === "POST") {
        const telemetry = {
          ts: new Date().toISOString(),
          method: req.method,
          contentType: req.headers["content-type"] || "",
          userAgent: req.headers["user-agent"] || "",
          contentLength: req.headers["content-length"] || ""
        };
        let input;
        try { input = Object.fromEntries(new URLSearchParams(await body(req))); }
        catch { return json(res, 400, { error: "invalid_request" }); }
        const client = state.clients[input.client_id];
        telemetry.clientIdPrefix = input.client_id ? String(input.client_id).slice(0, 16) : "";
        telemetry.grantType = input.grant_type || "";
        telemetry.hasCode = Boolean(input.code);
        telemetry.hasCodeVerifier = Boolean(input.code_verifier);
        telemetry.redirectUriPrefix = input.redirect_uri ? String(input.redirect_uri).slice(0, 180) : "";
        console.log("[omnikali-mcp] OAUTH_TOKEN_REQUEST", JSON.stringify(telemetry));
        if (!client || client.token_endpoint_auth_method !== "none") {
          console.log("[omnikali-mcp] OAUTH_TOKEN_RESULT", JSON.stringify({ status: 401, error: "invalid_client" }));
          return json(res, 401, { error: "invalid_client" });
        }
        if (input.grant_type === "authorization_code") {
          const c = state.codes[input.code];
          if (!c || c.expiresAt < now() || c.clientId !== client.client_id || c.redirectUri !== input.redirect_uri) {
            console.log("[omnikali-mcp] OAUTH_TOKEN_RESULT", JSON.stringify({ status: 400, error: "invalid_grant" }));
            return json(res, 400, { error: "invalid_grant" });
          }
          if (!verifyPKCE(input.code_verifier, c.challenge)) {
            console.log("[omnikali-mcp] OAUTH_TOKEN_RESULT", JSON.stringify({ status: 400, error: "invalid_grant", reason: "pkce_mismatch" }));
            return json(res, 400, { error: "invalid_grant" });
          }
          delete state.codes[input.code];
          const accessToken = id("at");
          const refreshToken = id("rt");
          const expiresIn = 3600;
          state.tokens[accessToken] = { sub: c.sub, email: c.email, scope: c.scope, expiresAt: now() + expiresIn, clientId: c.clientId };
          state.refresh[refreshToken] = { sub: c.sub, email: c.email, scope: c.scope, clientId: c.clientId, expiresAt: now() + 30 * 86400 };
          save();
          console.log("[omnikali-mcp] OAUTH_TOKEN_RESULT", JSON.stringify({ status: 200, grantType: "authorization_code", scope: c.scope, expiresIn, refreshIssued: true }));
          return json(res, 200, { access_token: accessToken, token_type: "Bearer", expires_in: expiresIn, refresh_token: refreshToken, scope: c.scope });
        }
        if (input.grant_type === "refresh_token") {
          const r = state.refresh[input.refresh_token];
          if (!r || r.expiresAt < now() || r.clientId !== client.client_id)
            return json(res, 400, { error: "invalid_grant" });
          const accessToken = id("at");
          const expiresIn = 3600;
          state.tokens[accessToken] = { sub: r.sub, email: r.email, scope: r.scope, expiresAt: now() + expiresIn, clientId: r.clientId };
          save();
          console.log("[omnikali-mcp] OAUTH_TOKEN_RESULT", JSON.stringify({ status: 200, grantType: "refresh_token", scope: r.scope, expiresIn, refreshIssued: false }));
          return json(res, 200, { access_token: accessToken, token_type: "Bearer", expires_in: expiresIn, scope: r.scope });
        }
        return json(res, 400, { error: "unsupported_grant_type" });
      }

      return false;
    },

    authorize(req) {
      const h = req.headers.authorization || "";
      if (!h.startsWith("Bearer ")) return null;
      const token = h.slice(7);
      const t = state.tokens[token];
      if (!t || t.expiresAt < now()) return null;
      return t;
    }
  };
}

[executed on device: ip-172-31-8-59 (882f1036-235b-4669-acaf-1e1135b156bd)]