export const VERSION = 1;

export const STATES = Object.freeze({
  agent: ["ready", "disabled"],
  task: ["queued", "running", "completed", "failed", "stopped", "orphaned"],
  lock: ["held", "expired"],
  resource: ["declared", "ready", "degraded", "absent"]
});

export function now() { return new Date().toISOString(); }
export function id(prefix) { return prefix + "_" + crypto.randomUUID(); }

export function assertState(kind, value) {
  if (!STATES[kind]?.includes(value)) throw new Error("invalid " + kind + " state: " + value);
}

export function emptyState() {
  return { version: VERSION, createdAt: now(), updatedAt: now(), agents: {}, tasks: {}, locks: {}, resources: {}, events: [] };
}

export function event(type, data) { return { id: id("evt"), type, at: now(), data }; }
