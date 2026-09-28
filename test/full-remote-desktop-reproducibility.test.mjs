import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("full remote desktop gate remains fail-closed", () => {
  const manifest = JSON.parse(fs.readFileSync("manifests/remote-desktop-production.json", "utf8"));
  assert.equal(manifest.status, "incomplete_until_full_path_acceptance");
  assert.equal(manifest.acceptance.dashboard_http, true);
  assert.equal(manifest.acceptance.authenticated_login, true);
  assert.equal(manifest.acceptance.wss_rfb_stream, true);
  assert.equal(manifest.acceptance.firefox_inside_guest, true);
  assert.equal(manifest.acceptance.persistent_reconnect, true);
  assert.equal(manifest.acceptance.no_public_vnc, true);
});

test("RDC pairing is not a hidden deployment prerequisite", () => {
  const doc = fs.readFileSync("docs/FULL_REMOTE_DESKTOP_REPRODUCIBILITY.md", "utf8");
  assert.match(doc, /RDC bootstrap intentionally depends on a previously paired Desktop Commander session/);
});
