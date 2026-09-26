import { id, now } from "./model.mjs";

export class DeterministicExecutor {
  constructor() { this.executions = new Map(); }
  async start(task, onExit) {
    const executionId = id("exec");
    const result = task.command.startsWith("fail:") ? { code: 1, signal: null, stdout: "", stderr: task.command.slice(5) } : { code: 0, signal: null, stdout: task.command.replace(/^ok:/, "").trim() + "\n", stderr: "" };
    this.executions.set(executionId, { executionId, startedAt: now(), result });
    return { executionId, startedAt: now(), result };
  }
  stop(executionId) { return this.executions.has(executionId); }
}

export function createExecutor(config) {
  if (config.kind === "deterministic") return new DeterministicExecutor();
  throw new Error("unsupported execution environment: " + config.kind);
}
