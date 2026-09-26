import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { emptyState, now } from "./model.mjs";

export class StateStore {
  constructor(path) { this.path = path; }
  async load() {
    try { return JSON.parse(await readFile(this.path, "utf8")); }
    catch (e) { if (e.code !== "ENOENT") throw e; return emptyState(); }
  }
  async save(state) {
    state.updatedAt = now();
    await mkdir(dirname(this.path), { recursive: true });
    const tmp = this.path + ".tmp-" + process.pid;
    await writeFile(tmp, JSON.stringify(state, null, 2) + "\n", { mode: 0o600 });
    await rename(tmp, this.path);
  }
  async update(fn) { const state = await this.load(); await fn(state); await this.save(state); return state; }
}
