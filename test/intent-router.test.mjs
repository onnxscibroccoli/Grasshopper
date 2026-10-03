import test from "node:test";
import assert from "node:assert/strict";
import { routeIntent, executeIntent } from "../src/intent-router.mjs";

test("native phone intent is capability routed, not emulated", () => {
  assert.deepEqual(routeIntent("open-native-phone"), { kind: "native-return", name: "open-native-phone" });
});

test("instance switching remains a control-plane operation", async () => {
  const calls = [];
  const cp = { switchInstance: async id => { calls.push(id); return { activeInstanceId: id }; } };
  const result = await executeIntent(cp, { name: "switch-instance", args: { instanceId: "inst_1" } });
  assert.equal(result.activeInstanceId, "inst_1");
  assert.deepEqual(calls, ["inst_1"]);
});

test("native return fails closed without a native capability", async () => {
  await assert.rejects(() => executeIntent({}, "return-to-phone"), /capability is unavailable/);
});
