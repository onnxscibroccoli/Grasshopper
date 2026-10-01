import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

export const ANDROID_ACTIONS = Object.freeze([
  "device.identity",
  "display.list",
  "tap",
  "swipe",
  "text",
  "keyevent",
]);

function validateAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new TypeError("Android action must be an object");
  }
  if (!ANDROID_ACTIONS.includes(action.action)) {
    throw new Error(`Android action is not allowlisted: ${String(action.action)}`);
  }
}

export async function executeAndroidAction(action, {
  broccoliRoot = process.env.BROCCOLI_ROOT || path.join(process.env.HOME || ".", "broccoli-core"),
  python = process.env.BROCCOLI_PYTHON || "python3",
  timeoutMs = 30_000,
  exec = execFileAsync,
} = {}) {
  validateAction(action);

  const cli = path.join(broccoliRoot, "tools", "android_action_cli.py");
  const input = JSON.stringify(action);
  const { stdout, stderr } = await exec(
    python,
    [cli],
    {
      input,
      timeout: timeoutMs,
      maxBuffer: 2 * 1024 * 1024,
    },
  );

  const result = JSON.parse(stdout);
  if (!result || typeof result !== "object") {
    throw new Error("Android action CLI returned invalid JSON");
  }

  return {
    ...result,
    transport: "Grasshopper->broccoli-core CLI->Rish->Shizuku->Android-shell",
    stderr: [result.stderr, stderr].filter(Boolean).join(""),
  };
}
