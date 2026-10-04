import { spawn } from "node:child_process";
import path from "node:path";

// Transport owner: onnxscibroccoli/broccoli-rish (lib/rish_run.sh, RishTransport).
// This client still shells to broccoli-core/tools/android_action_cli.py until that
// CLI is extracted. Do not add a second Rish wrapper here.

export const ANDROID_ACTIONS = Object.freeze([
  "device.identity",
  "display.list",
  "ui.dump",
  "package.inspect",
  "package.export",
  "app.launch",
  "app.stop",
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
    throw new Error("Android action is not allowlisted: " + String(action.action));
  }
}

export async function executeAndroidAction(action, {
  broccoliRoot = process.env.BROCCOLI_ROOT || path.join(process.env.HOME || ".", "broccoli-core"),
  python = process.env.BROCCOLI_PYTHON || "python3",
  timeoutMs = 30_000,
  spawnProcess = spawn,
} = {}) {
  validateAction(action);

  const cli = path.join(broccoliRoot, "tools", "android_action_cli.py");
  const input = JSON.stringify(action);

  return await new Promise((resolve, reject) => {
    const child = spawnProcess(python, [cli], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      fn(value);
    };

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      finish(reject, new Error("Android action timed out after " + timeoutMs + "ms"));
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => {
      clearTimeout(timer);
      finish(reject, error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      let result;
      try {
        result = JSON.parse(stdout);
      } catch (error) {
        finish(reject, new Error("Android action CLI returned invalid JSON: " + error.message + "; stderr=" + stderr));
        return;
      }

      const evidence = {
        ...result,
        returncode: result.returncode ?? code,
        transport: "Grasshopper->broccoli-core CLI->broccoli-rish RishTransport->Rish->Shizuku->Android-shell",
        stderr: [result.stderr, stderr].filter(Boolean).join(""),
      };

      if (code !== 0 || evidence.ok !== true) {
        const detail = evidence.message || evidence.combined_output || evidence.stderr || ("exit code " + code);
        finish(reject, Object.assign(
          new Error("Android action failed: " + detail),
          { evidence },
        ));
        return;
      }

      finish(resolve, evidence);
    });

    child.stdin?.end(input);
  });
}
