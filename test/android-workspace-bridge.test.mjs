import test from "node:test";
import assert from "node:assert/strict";
import { AndroidWorkspaceBridge } from "../src/android/android-workspace-bridge.mjs";

test("Android workspace bridge uses bounded actions and exposes virtual display capability", async () => {
  const calls = [];
  const bridge = new AndroidWorkspaceBridge({
    action: async request => { calls.push(request); return { ok: true, result: request }; }
  });
  const observed = await bridge.inspect();
  assert.deepEqual(observed.capabilities, ["android.actions", "native-return", "virtual-display"]);
  await bridge.launch("com.android.settings");
  await bridge.tap(36, 10, 20);
  await bridge.swipe(36, 10, 20, 30, 400);
  await bridge.text(36, "hello");
  await bridge.keyevent(36, "ENTER");
  assert.equal(calls.length, 7);
  assert.equal(calls[3].display_id, 36);
});

test("native return is explicit and fail-closed", async () => {
  await assert.rejects(() => new AndroidWorkspaceBridge().returnToNativePhone(), /capability is unavailable/);
  let reason;
  const bridge = new AndroidWorkspaceBridge({ nativeReturn: value => { reason = value.reason; return "native"; } });
  assert.equal(await bridge.returnToNativePhone(), "native");
  assert.equal(reason, "user-intent");
});
