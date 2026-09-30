import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const path = "scripts/oci-kali-rolling-workstation-bootstrap.sh";
const script = fs.readFileSync(path, "utf8");

test("OCI Kali workstation uses the official Kali Rolling ARM64 image", () => {
  assert.match(script, /docker\.io\/kalilinux\/kali-rolling:arm64/);
  assert.ok(script.includes("127.0.0.1:${HOST_VNC_PORT}"));
});

test("OCI Kali workstation keeps VNC loopback-only and persists home", () => {
  assert.ok(script.includes('--publish "127.0.0.1:${HOST_VNC_PORT}:${CONTAINER_PORT}"'));
  assert.ok(script.includes('--volume "${HOME_DIR}:/home/kali:Z"'));
  assert.match(script, /grasshopper-kali\.service/);
  assert.match(script, /grasshopper-novnc\.service/);
});

test("OCI Kali workstation explicitly identifies itself before reporting ready", () => {
  assert.match(script, /cat \/etc\/os-release/);
  assert.match(script, /dpkg --print-architecture/);
  assert.match(script, /KALI ROLLING WORKSTATION READY/);
});
