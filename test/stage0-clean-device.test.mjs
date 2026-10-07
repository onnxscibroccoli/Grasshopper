import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("stage 0 collector is fail-closed", () => {
  const s = fs.readFileSync("scripts/cloud-android/stage0-clean-device.sh", "utf8");
  assert.match(s, /new_qemu_started/);
  assert.match(s, /admission/);
  assert.match(s, /benchmark_available/);
  assert.match(s, /exit 75/);
});
