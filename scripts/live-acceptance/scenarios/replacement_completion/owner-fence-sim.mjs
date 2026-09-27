/**
 * In-memory Helix-shaped owner fencing for replacement_completion dry-run.
 * Mirrors accepted pin 38903b021cca75189a99e1ed88b508bae577f048 semantics:
 * claim PENDING or expired RUNNING; complete/fail require current owner.
 * No PostgreSQL, Helix, or production I/O.
 */

export const TASK_STATES = Object.freeze({
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED"
});

/**
 * @typedef {{
 *   task_id: string,
 *   state: string,
 *   owner_id: string | null,
 *   lease_expires_at: number | null,
 *   attempts: number,
 *   result: unknown,
 *   error: unknown,
 *   events: Array<Record<string, unknown>>
 * }} SimTask
 */

export class OwnerFenceSim {
  constructor({ nowMs = Date.now(), leaseMs = 45_000 } = {}) {
    /** @type {Map<string, SimTask>} */
    this.tasks = new Map();
    this.nowMs = nowMs;
    this.leaseMs = leaseMs;
  }

  createTask(taskId) {
    if (this.tasks.has(taskId)) throw new Error("task already exists");
    /** @type {SimTask} */
    const task = {
      task_id: taskId,
      state: TASK_STATES.PENDING,
      owner_id: null,
      lease_expires_at: null,
      attempts: 0,
      result: null,
      error: null,
      events: [
        {
          from_state: null,
          to_state: TASK_STATES.PENDING,
          owner_id: null,
          detail: { reason: "created" }
        }
      ]
    };
    this.tasks.set(taskId, task);
    return structuredClone(task);
  }

  /**
   * Claim PENDING, or RUNNING with expired lease (replacement path).
   */
  claimNext(ownerId, { taskId = null } = {}) {
    for (const task of this.tasks.values()) {
      if (taskId && task.task_id !== taskId) continue;
      const expiredRunning =
        task.state === TASK_STATES.RUNNING &&
        task.lease_expires_at !== null &&
        task.lease_expires_at < this.nowMs;
      if (task.state === TASK_STATES.PENDING || expiredRunning) {
        const previous = task.state;
        task.state = TASK_STATES.RUNNING;
        task.owner_id = ownerId;
        task.attempts += 1;
        task.lease_expires_at = this.nowMs + this.leaseMs;
        task.events.push({
          from_state: previous,
          to_state: TASK_STATES.RUNNING,
          owner_id: ownerId,
          detail: { attempts: task.attempts, replacement: expiredRunning }
        });
        return structuredClone(task);
      }
    }
    return null;
  }

  reconcileExpired() {
    const reclaimed = [];
    for (const task of this.tasks.values()) {
      if (
        task.state === TASK_STATES.RUNNING &&
        task.lease_expires_at !== null &&
        task.lease_expires_at < this.nowMs
      ) {
        task.state = TASK_STATES.PENDING;
        const prevOwner = task.owner_id;
        task.owner_id = null;
        task.lease_expires_at = null;
        task.events.push({
          from_state: TASK_STATES.RUNNING,
          to_state: TASK_STATES.PENDING,
          owner_id: null,
          detail: { reason: "lease_expired", previous_owner: prevOwner, attempts: task.attempts }
        });
        reclaimed.push(structuredClone(task));
      }
    }
    return reclaimed;
  }

  complete(taskId, ownerId, result = {}) {
    return this.#finish(taskId, ownerId, TASK_STATES.COMPLETED, { result });
  }

  fail(taskId, ownerId, error = {}) {
    return this.#finish(taskId, ownerId, TASK_STATES.FAILED, { error });
  }

  #finish(taskId, ownerId, state, data) {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error("task not found");
    if (task.state !== TASK_STATES.RUNNING) throw new Error("task is not RUNNING");
    if (task.owner_id !== ownerId) {
      throw new Error("task completion rejected: owner mismatch");
    }
    task.state = state;
    if (state === TASK_STATES.COMPLETED) task.result = data.result ?? null;
    if (state === TASK_STATES.FAILED) task.error = data.error ?? null;
    task.lease_expires_at = null;
    task.events.push({
      from_state: TASK_STATES.RUNNING,
      to_state: state,
      owner_id: ownerId,
      detail: data
    });
    return structuredClone(task);
  }

  getTask(taskId) {
    const task = this.tasks.get(taskId);
    return task ? structuredClone(task) : null;
  }

  advanceTime(ms) {
    this.nowMs += ms;
  }
}

/**
 * Run a fixture script against OwnerFenceSim.
 * @param {{ steps: Array<Record<string, unknown>>, expect?: Record<string, unknown> }} fixture
 */
export function runFixture(fixture) {
  const sim = new OwnerFenceSim({
    nowMs: Number(fixture.nowMs ?? 1_000_000),
    leaseMs: Number(fixture.leaseMs ?? 45_000)
  });
  const log = [];

  for (const step of fixture.steps || []) {
    const op = step.op;
    try {
      let out;
      if (op === "create") {
        out = sim.createTask(String(step.taskId));
      } else if (op === "claim") {
        out = sim.claimNext(String(step.ownerId), {
          taskId: step.taskId ? String(step.taskId) : null
        });
      } else if (op === "advance") {
        sim.advanceTime(Number(step.ms));
        out = { nowMs: sim.nowMs };
      } else if (op === "reconcile") {
        out = sim.reconcileExpired();
      } else if (op === "complete") {
        out = sim.complete(String(step.taskId), String(step.ownerId), step.result ?? { ok: true });
      } else if (op === "fail") {
        out = sim.fail(String(step.taskId), String(step.ownerId), step.error ?? { message: "fail" });
      } else if (op === "assert") {
        const task = sim.getTask(String(step.taskId));
        if (!task) throw new Error(`assert: missing task ${step.taskId}`);
        if (step.state && task.state !== step.state) {
          throw new Error(`assert: state want ${step.state} got ${task.state}`);
        }
        if (Object.prototype.hasOwnProperty.call(step, "ownerId")) {
          const want = step.ownerId === null ? null : String(step.ownerId);
          if (task.owner_id !== want) {
            throw new Error(`assert: owner want ${want} got ${task.owner_id}`);
          }
        }
        out = task;
      } else {
        throw new Error(`unknown fixture op: ${op}`);
      }
      log.push({ op, ok: true, out });
    } catch (err) {
      const message = err?.message || String(err);
      if (step.expectError) {
        const re = new RegExp(String(step.expectError));
        if (!re.test(message)) {
          throw new Error(`expected error /${step.expectError}/ but got: ${message}`);
        }
        log.push({ op, ok: true, expectedError: message });
        continue;
      }
      throw err;
    }
  }

  if (fixture.expect?.finalState) {
    const task = sim.getTask(String(fixture.expect.taskId));
    if (!task) throw new Error("expect.finalState: task missing");
    if (task.state !== fixture.expect.finalState) {
      throw new Error(
        `expect.finalState want ${fixture.expect.finalState} got ${task.state}`
      );
    }
    if (Object.prototype.hasOwnProperty.call(fixture.expect, "finalOwner")) {
      const want =
        fixture.expect.finalOwner === null ? null : String(fixture.expect.finalOwner);
      if (task.owner_id !== want) {
        throw new Error(`expect.finalOwner want ${want} got ${task.owner_id}`);
      }
    }
  }

  return { ok: true, log, sim };
}
