import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { executeAndroidAction } from "../src/android/android-action-client.mjs";

function fakeSpawn(output, expectedRoot, expectedAction = "device.identity", code = 0) {
  return (_file, args, options) => {
    assert.deepEqual(args, [`${expectedRoot}/tools/android_action_cli.py`]);
    assert.deepEqual(options.stdio, ["pipe", "pipe", "pipe"]);
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { end(value) {
      assert.equal(JSON.parse(value).action, expectedAction);
      queueMicrotask(() => {
        child.stdout.emit("data", output);
        child.emit("close", code);
      });
    }};
    child.kill = () => {};
    return child;
  };
}

test("rejects arbitrary action before execution", async () => {
  await assert.rejects(
    () => executeAndroidAction({ action: "shell", command: "id" }, {
      spawnProcess: () => { throw new Error("spawn must not be reached"); },
    }),
    /not allowlisted/,
  );
});

test("returns structured CLI evidence", async () => {
  const root = "/recovered/broccoli-core";
  const result = await executeAndroidAction(
    { action: "device.identity" },
    {
      broccoliRoot: root,
      spawnProcess: fakeSpawn(JSON.stringify({
        ok: true,
        returncode: 0,
        stdout: "ANDROID_IDENTITY_OK\n",
        stderr: "uid=2000(shell)\n",
        combined_output: "ANDROID_IDENTITY_OK\nuid=2000(shell)\n",
      }), root),
    },
  );
  assert.equal(result.ok, true);
  assert.match(result.combined_output, /uid=2000\(shell\)/);
});

test("propagates failed CLI evidence", async () => {
  const root = "/recovered/broccoli-core";
  await assert.rejects(
    () => executeAndroidAction(
      { action: "tap", display_id: 0, x: 1, y: 2 },
      {
        broccoliRoot: root,
        spawnProcess: fakeSpawn(JSON.stringify({
          ok: false,
          returncode: 1,
          stdout: "",
          stderr: "action failure",
          combined_output: "action failure",
        }), root, "tap", 1),
      },
    ),
    /action failure/,
  );
});
