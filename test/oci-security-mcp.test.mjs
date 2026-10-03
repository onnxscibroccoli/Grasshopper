import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync("mcp/oci-security/server.mjs","utf8");

test("OCI security MCP is fail-closed and SSH-bound",()=>{
  assert.match(source,/BatchMode=yes/);
  assert.match(source,/StrictHostKeyChecking=yes/);
  assert.match(source,/ForwardAgent=no/);
  assert.match(source,/ClearAllForwardings=yes/);
  assert.match(source,/UserKnownHostsFile/);
  assert.match(source,/GRASSHOPPER_OCI_LOCAL/);
  assert.match(source,/spawn\("bash"/);
  assert.match(source,/Action is not allowlisted/);
  assert.match(source,/Write action requires confirm=true/);
  assert.match(source,/arbitrary shell/);
});

test("OCI security MCP exposes only explicit security actions",()=>{
  assert.match(source,/name: "oci_" \+ name/);
  for (const action of ["status","firewall_status","ssh_hardening_check","security_updates","fail2ban_status","audit_tail","security_updates_apply","fail2ban_restart"])
    assert.match(source,new RegExp(action));
  assert.doesNotMatch(source,/exec\\s*:\\s*shell/);
});
