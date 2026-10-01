import { createApplicationModel } from "./application-model.mjs";

export async function inspectAndroidApplication(packageName, {
  executeAction,
} = {}) {
  if (typeof executeAction !== "function") {
    throw new TypeError("executeAction is required");
  }
  if (typeof packageName !== "string" || !/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/.test(packageName)) {
    throw new TypeError("invalid Android package name");
  }

  const identity = await executeAction({ action: "device.identity" });
  const packageInfo = await executeAction({ action: "package.inspect", package: packageName });
  const ui = await executeAction({ action: "ui.dump" });

  return createApplicationModel({
    source: "android-live",
    identity: { package: packageName },
    evidence: [
      { action: "device.identity", result: identity },
      { action: "package.inspect", result: packageInfo },
      { action: "ui.dump", result: ui },
    ],
    elements: [],
  });
}

export async function exportAndroidApplication(packageName, {
  executeAction,
} = {}) {
  if (typeof executeAction !== "function") {
    throw new TypeError("executeAction is required");
  }
  return executeAction({ action: "package.export", package: packageName });
}
