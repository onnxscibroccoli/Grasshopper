import test from "node:test";
import assert from "node:assert/strict";
import { executeAndroidAction } from "../src/android/android-action-client.mjs";

test("rejects arbitrary shell action before execution", async () => {
  await assert.rejects(
    () => executeAndroidAction({ action: "shell", command: "id" }, {
      exec: async () => {
        throw new Error("exec must not be reached");
      },
    }),
    /not allowlisted/,
  );
});

test("returns structured CLI evidence", async () => {
  const result = await executeAndroidAction(
    { action: "device.identity" },
    {
      broccoliRoot: "/recovered/broccoli-core",
      exec: async (file, args, options) => {
        assert.equal(file, "python3");
        assert.deepEqual(args, ["/recovered/broccoli-core/tools/android_action_cli.py"]);
        assert.equal(JSON.parse(options.input).action, "device.identity");
        return {
          stdout: JSON.stringify({
            ok: true,
            returncode: 0,
            stdout: "OMNIKALI_ANDROID_IDENTITY_OK\n",
            stderr: "uid=2000(shell)\n",
            combined_output: "OMNIKALI_ANDROID_IDENTITY_OK\nuid=2000(shell)\n",
          }),
          stderr: "",
        };
      },
    },
  );

  assert.equal(result.ok, true);
  assert.match(result.combined_output, /uid=2000\(shell\)/);
  assert.match(result.transport, /broccoli-core CLI/);
});
