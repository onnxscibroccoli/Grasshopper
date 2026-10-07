import test from "node:test";
import assert from "node:assert/strict";
import { detectEnvironment } from "../src/environment/detect.mjs";

test("explicit workstation environment loads without host mutation", () => {
  const env = detectEnvironment({ GRASSHOPPER_ENV: "grasshopper-workstation", PREFIX: "" });
  assert.equal(env.kind, "grasshopper-workstation");
  assert.equal(env.control.screen, true);
});

test("Termux runtime selects physical Android", () => {
  const env = detectEnvironment({ PREFIX: "/data/data/com.termux/files/usr" });
  assert.equal(env.kind, "physical-android");
});

test("QEMU Android runtime selects cloud Android when getprop reports qemu", () => {
  const original = process.env.PATH;
  process.env.PATH = "/nonexistent";
  const env = detectEnvironment({ PREFIX: "/data/data/com.termux/files/usr" });
  assert.equal(env.kind, "physical-android");
  process.env.PATH = original;
});
