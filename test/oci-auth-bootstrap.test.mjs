import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("OCI auth gateway is fail-closed and never contains credentials", () => {
  const source = fs.readFileSync("scripts/oci-secure-gateway-bootstrap.sh", "utf8");
  assert.match(source, /GRASSHOPPER_AUTH_DOMAIN/);
  assert.match(source, /GRASSHOPPER_OAUTH_CLIENT_ID/);
  assert.match(source, /GRASSHOPPER_OAUTH_CLIENT_SECRET/);
  assert.match(source, /GRASSHOPPER_ALLOWED_EMAIL/);
  assert.match(source, /authenticated_emails_file/);
  assert.match(source, /GRASSHOPPER_OIDC_ISSUER_URL/);
  assert.match(source, /oidc_issuer_url/);
  assert.match(source, /cookie_secure = true/);
  assert.match(source, /cookie_httponly = true/);
  assert.match(source, /trusted_proxy_ips/);
  assert.match(source, /proxy_websockets = true/);
  assert.match(source, /127\.0\.0\.1:5901/);
  assert.match(source, /127\.0\.0\.1:6080/);
  assert.doesNotMatch(source, /gho_[A-Za-z0-9_]+/);
  assert.doesNotMatch(source, /AIza[A-Za-z0-9_-]{20,}/);
});

test("OCI auth documentation requires OAuth before desktop exposure", () => {
  const doc = fs.readFileSync("docs/OCI_AUTHENTICATED_DESKTOP.md", "utf8");
  assert.match(doc, /authenticated desktop/i);
  assert.match(doc, /5901.*localhost/i);
  assert.match(doc, /6080.*localhost/i);
});
