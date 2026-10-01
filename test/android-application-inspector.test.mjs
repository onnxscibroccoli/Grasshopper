import test from "node:test";
import assert from "node:assert/strict";
import { inspectAndroidApplication, exportAndroidApplication } from "../src/application/android-application-inspector.mjs";

test("android inspection gathers identity, package, and UI evidence", async () => {
  const calls = [];
  const result = await inspectAndroidApplication("com.example.app", {
    executeAction: async (action) => {
      calls.push(action);
      return { ok: true, action: action.action };
    },
  });

  assert.deepEqual(calls.map((action) => action.action), [
    "device.identity",
    "package.inspect",
    "ui.dump",
  ]);
  assert.equal(result.schema, "omnikali.application.model/v1");
  assert.equal(result.identity.package, "com.example.app");
  assert.equal(result.evidence.length, 3);
});

test("android package export delegates to bounded action", async () => {
  const result = await exportAndroidApplication("com.example.app", {
    executeAction: async (action) => {
      assert.deepEqual(action, { action: "package.export", package: "com.example.app" });
      return { ok: true };
    },
  });

  assert.equal(result.ok, true);
});

test("invalid package names fail closed", async () => {
  await assert.rejects(
    () => inspectAndroidApplication("com.example;id", { executeAction: async () => ({}) }),
    /invalid Android package name/,
  );
});
