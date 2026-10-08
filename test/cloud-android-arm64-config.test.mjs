import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const script = fs.readFileSync(path.join(root, "scripts/cloud-android/arm64-device.sh"), "utf8");
const env = JSON.parse(fs.readFileSync(path.join(root, "environments/cloud-android-arm64.json"), "utf8"));

test("ARM64 OCI launcher is architecture-native", () => {
  assert.match(script, /qemu-system-aarch64/);
  assert.match(script, /virtio-gpu-pci/);
  assert.match(script, /usb-kbd/);
  assert.match(script, /usb-tablet/);
  assert.ok(script.includes('RESET_EFI="${CLOUD_ANDROID_ARM64_RESET_EFI:-0}"'));
  assert.ok(script.includes('truncate -s 64M "$EFI_VARS"'));
  assert.doesNotMatch(script, /boot-helper.img/);
  assert.doesNotMatch(script, /startup.nsh/);
  assert.match(script, /-device virtio-blk-pci,drive=vda,bootindex=0/);
  assert.doesNotMatch(script, /qemu-system-x86_64/);
  assert.doesNotMatch(script, /-enable-kvm/);
});

test("ARM64 launcher pins the upstream release", () => {
  assert.match(script, /v2026.07.09/);
  assert.match(script, /55dcf50038de1ad460a680d82146294151c9301084c4b88c7ddc0323bade5e53/);
  assert.match(script, /arm64only/);
});

test("ARM64 environment is explicitly OCI and TCG", () => {
  assert.equal(env.kind, "cloud-android");
  assert.equal(env.execution.provider, "oracle-cloud");
  assert.equal(env.parameters.architecture, "arm64");
  assert.equal(env.parameters.resource_profile.acceleration, "tcg");
  assert.equal(env.parameters.resource_profile.memory_mb, 1536);
  assert.equal(env.parameters.resource_profile.cpus, 2);
  assert.equal(env.control.screen, true);
  assert.equal(env.control.input, true);
  assert.equal(env.control.adb, true);
});
