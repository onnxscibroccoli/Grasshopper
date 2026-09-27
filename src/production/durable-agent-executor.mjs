import { id, now } from "../model.mjs";
import { COMMAND_DISPOSITIONS, COMPLETION_STATES, commandDisposition } from "../executor-contract.mjs";

function resultForFailure(error) {
  return {
    code: null,
    signal: null,
    stdout: "",
    stderr: error?.message || "executor failure",
    interrupted: true,
    completion: COMPLETION_STATES.INDETERMINATE
  };
}

export class DurableAgentExecutor {
  constructor({ store, adapter }) {
    if (!store || !adapter?.start) throw new Error("store and adapter.start are required");
    this.store = store;
    this.adapter = adapter;
  }

  async start(task) {
    const disposition = commandDisposition(task);
    const operationKey = task.operationKey || task.id;
    const state = await this.store.load();
    const existing = state.executions?.[operationKey];

    if (existing) {
      if (existing.status === "confirmed" || existing.status === "cancelled" || existing.status === "indeterminate") {
        return { ...existing, duplicate: true };
      }
      if (existing.status === "dispatching" || existing.status === "dispatched") {
        return {
          ...existing,
          duplicate: true,
          result: {
            code: null,
            signal: null,
            stdout: "",
            stderr: "",
            completion: COMPLETION_STATES.INDETERMINATE,
            interrupted: true
          }
        };
      }
    }

    const execution = {
      executionId: id("exec"),
      operationKey,
      disposition,
      status: "dispatching",
      startedAt: now(),
      cancellation: { requested: false, acknowledged: false, acknowledgedAt: null }
    };

    await this.store.update(s => {
      s.executions ||= {};
      const current = s.executions[operationKey];
      if (current) return;
      s.executions[operationKey] = execution;
    });

    const reservation = (await this.store.load()).executions?.[operationKey];

    if (!reservation || reservation.executionId !== execution.executionId) {
      return {
        ...(reservation || {
          operationKey,
          status: "indeterminate",
          result: {
            code: null,
            signal: null,
            stdout: "",
            stderr: "operation reservation lost",
            completion: COMPLETION_STATES.INDETERMINATE,
            interrupted: true
          }
        }),
        duplicate: true,
        ...(reservation?.status === "dispatching" || reservation?.status === "dispatched"
          ? {
              result: {
                code: null,
                signal: null,
                stdout: "",
                stderr: "",
                completion: COMPLETION_STATES.INDETERMINATE,
                interrupted: true
              }
            }
          : {})
      };
    }

    try {
      const result = await this.adapter.start(task);
      const completed = {
        ...execution,
        status:
          result.completion === COMPLETION_STATES.CANCELLED
            ? "cancelled"
            : result.completion === COMPLETION_STATES.INDETERMINATE
              ? "indeterminate"
              : "confirmed",
        result,
        finishedAt: now()
      };
      await this.store.update(s => {
        completed.cancellation = s.executions[operationKey]?.cancellation || execution.cancellation;
        s.executions[operationKey] = completed;
      });
      return completed;
    } catch (error) {
      const result = resultForFailure(error);
      const indeterminate = { ...execution, status: "indeterminate", result, finishedAt: now() };
      await this.store.update(s => {
        indeterminate.cancellation = s.executions[operationKey]?.cancellation || execution.cancellation;
        s.executions[operationKey] = indeterminate;
      });
      return indeterminate;
    }
  }

  async cancel(executionId) {
    const state = await this.store.load();
    const execution = Object.values(state.executions || {}).find(e => e.executionId === executionId);
    if (!execution) return { acknowledged: false, reason: "unknown_execution" };
    if (execution.status === "confirmed" || execution.status === "cancelled") {
      return { acknowledged: false, reason: "already_finished" };
    }

    if (typeof this.adapter.cancel !== "function") {
      await this.store.update(s => {
        const current = s.executions[execution.operationKey];
        if (!current) return;
        current.cancellation.requested = true;
      });
      return { acknowledged: false, reason: "executor_cancellation_unsupported" };
    }

    const acknowledgement = await this.adapter.cancel(executionId);
    if (!acknowledgement?.acknowledged) {
      return { acknowledged: false, reason: acknowledgement?.reason || "not_acknowledged" };
    }

    await this.store.update(s => {
      const current = s.executions[execution.operationKey];
      if (!current) return;
      current.cancellation = {
        requested: true,
        acknowledged: true,
        acknowledgedAt: now()
      };
      current.status = "cancelled";
    });

    return { acknowledged: true, reason: "cancelled" };
  }
}
