import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("OCI security privilege installer uses root-owned fixed wrappers",()=>{
  const source=fs.readFileSync("scripts/oci-security/install-sudo-policy.sh","utf8");
  assert.match(source,/EUID/);
  assert.match(source,/\/usr\/local\/libexec\/grasshopper-oci-security/);
  assert.match(source,/chown root:root/);
  assert.match(source,/chmod 0440/);
  assert.match(source,/visudo -cf/);
  assert.doesNotMatch(source,/NOPASSWD: ALL/);
});
// Regression: Reference tests run 37092782814 (f09c265) failed this test because
// write actions used `sudo -n dnf` and `sudo -n systemctl restart` instead of the
// root-owned libexec wrappers. setup-node succeeded; this is not the npm-cache issue.
test("MCP write actions call only fixed wrappers",()=>{
  const source=fs.readFileSync("mcp/oci-security/server.mjs","utf8");
  assert.match(source,/sudo -n \/usr\/local\/libexec\/grasshopper-oci-security\/apply-security-updates/);
  assert.match(source,/sudo -n \/usr\/local\/libexec\/grasshopper-oci-security\/restart-fail2ban/);
  assert.doesNotMatch(source,/sudo -n dnf/);
  assert.doesNotMatch(source,/sudo -n systemctl restart/);
});
