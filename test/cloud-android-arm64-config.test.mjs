import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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
  assert.equal(env.parameters.resource_profile.memory_mb, 2048);
  assert.equal(env.parameters.resource_profile.cpus, 2);
  assert.equal(env.control.screen, true);
  assert.equal(env.control.input, true);
  assert.equal(env.control.adb, true);
  assert.equal(env.control.adb_normal_shell, "conditional");
  assert.equal(env.parameters.android_build_profile.variant, "user");
  assert.equal(env.parameters.android_build_profile.normal_adb_shell, "requires_completed_setup_and_explicit_adb_enablement");
  assert.equal(env.parameters.android_build_profile.automation_profile, "requires_provenance_pinned_full_userdebug_vm");
});

test("pinned Android 16 user archive blocks normal-shell automation by default", () => {
  const result = spawnSync("bash", ["scripts/cloud-android/arm64-device.sh", "profile-admission"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env },
  });

  assert.equal(result.status, 75);
  assert.match(result.stderr, /ANDROID16_USER_BUILD_SETUP_GATED/);
  assert.doesNotMatch(result.stdout, /AUTOMATION_READY/);
});

test("interactive provisioning override remains explicitly setup-gated", () => {
  const result = spawnSync("bash", ["scripts/cloud-android/arm64-device.sh", "profile-admission"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CLOUD_ANDROID_ARM64_ALLOW_SETUP_GATED: "1" },
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /PROFILE_ADMITTED=INTERACTIVE_SETUP_ONLY/);
  assert.match(result.stdout, /NORMAL_ADB_SHELL=NOT_PROVEN/);
  assert.doesNotMatch(result.stdout, /AUTOMATION_READY/);
});
