import { id, now } from "./model.mjs";

export class DeterministicExecutor {
  constructor() { this.executions = new Map(); this.operations = new Map(); }

  async start(task, onExit) {
    const operationKey = task.operationKey || task.id;
    const existingId = this.operations.get(operationKey);
    if (existingId) {
      const existing = this.executions.get(existingId);
      if (existing) return { ...existing, duplicate: true };
    }

    const executionId = id("exec");
    const execution = {
      executionId,
      operationKey,
      startedAt: now(),
      result: null,
      cancellation: { requested: false, acknowledged: false, acknowledgedAt: null }
    };
    this.executions.set(executionId, execution);
    this.operations.set(operationKey, executionId);

    if (task.command.startsWith("hold:")) {
      return { ...execution };
    }

    const result = task.command.startsWith("fail:")
      ? { code: 1, signal: null, stdout: "", stderr: task.command.slice(5), canceled: false, completion: "confirmed" }
      : task.command.startsWith("interrupt:")
        ? { code: null, signal: "SIGKILL", stdout: "", stderr: "", canceled: false, interrupted: true, completion: "indeterminate" }
        : { code: 0, signal: null, stdout: task.command.replace(/^ok:/, "").trim() + "\n", stderr: "", canceled: false, completion: "confirmed" };

    execution.result = result;
    execution.finishedAt = now();
    if (onExit) await onExit(result);
    return { ...execution };
  }

  async cancel(executionId, onExit) {
    const execution = this.executions.get(executionId);
    if (!execution) return { acknowledged: false, reason: "unknown_execution" };
    if (execution.result) return { acknowledged: false, reason: "already_finished" };
    execution.cancellation.requested = true;
    execution.cancellation.acknowledged = true;
    execution.cancellation.acknowledgedAt = now();
    execution.result = { code: null, signal: "SIGTERM", stdout: "", stderr: "", canceled: true, completion: "cancelled" };
    execution.finishedAt = now();
    if (onExit) await onExit(execution.result);
    return { acknowledged: true, reason: "cancelled" };
  }

  stop(executionId, onExit) { return this.cancel(executionId, onExit); }
}

export function createExecutor(config) {
  if (config.kind === "deterministic") return new DeterministicExecutor();
  throw new Error("unsupported execution environment: " + config.kind);
}
