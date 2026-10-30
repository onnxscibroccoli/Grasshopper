import { executeAndroidAction } from "./android-action-client.mjs";

export class AndroidWorkspaceBridge {
  constructor({ action = executeAndroidAction, nativeReturn } = {}) {
    this.action = action;
    this.nativeReturn = nativeReturn;
    this.name = "android-worker";
  }

  async inspect() {
    const identity = await this.action({ action: "device.identity" });
    const displays = await this.action({ action: "display.list" });
    return { ok: true, identity: identity.result || identity, displays: displays.result || displays, capabilities: ["android.actions", "native-return", "virtual-display"] };
  }

  async launch(packageName, { displayId } = {}) {
    if (!/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+$/.test(packageName)) throw new Error("invalid Android package name");
    if (displayId != null) throw new Error("app.launch display targeting is not part of the bounded action contract");
    return this.action({ action: "app.launch", package: packageName });
  }

  async tap(displayId, x, y) {
    return this.action({ action: "tap", display_id: Number(displayId), x: Number(x), y: Number(y) });
  }

  async swipe(displayId, x1, y1, x2, y2, durationMs = 300) {
    return this.action({ action: "swipe", display_id: Number(displayId), start: [Number(x1), Number(y1)], end: [Number(x2), Number(y2)], duration_ms: Number(durationMs) });
  }

  async text(displayId, value) {
    if (typeof value !== "string" || value.length > 4096) throw new Error("invalid Android text input");
    return this.action({ action: "text", display_id: Number(displayId), text: value });
  }

  async keyevent(displayId, key) {
    if (!/^[A-Z0-9_]+$/.test(String(key))) throw new Error("invalid Android keyevent");
    return this.action({ action: "keyevent", display_id: Number(displayId), key: String(key) });
  }

  async returnToNativePhone(reason = "user-intent") {
    if (typeof this.nativeReturn !== "function") throw new Error("native-return capability is unavailable");
    return this.nativeReturn({ reason });
  }
}
