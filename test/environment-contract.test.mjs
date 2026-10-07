import test from "node:test";
import assert from "node:assert/strict";
import { detectEnvironment } from "../src/environment/detect.mjs";

test("explicit workstation environment loads", () => {
  const env = detectEnvironment({ GRASSHOPPER_ENV: "grasshopper-workstation", PREFIX: "" });
  assert.equal(env.kind, "grasshopper-workstation");
  assert.equal(env.control.screen, true);
});

test("Termux runtime selects physical Android", () => {
  const env = detectEnvironment({ PREFIX: "/data/data/com.termux/files/usr" });
  assert.equal(env.kind, "physical-android");
});

test("explicit cloud Android environment loads", () => {
  const env = detectEnvironment({ GRASSHOPPER_ENV: "cloud-android", PREFIX: "" });
  assert.equal(env.kind, "cloud-android");
  assert.equal(env.control.bidirectional, true);
});
