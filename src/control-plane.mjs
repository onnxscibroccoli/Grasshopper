import { event, id, now } from "./model.mjs";
import { commandDisposition } from "./executor-contract.mjs";

const AUDIT_TYPE = /^[a-z][a-z0-9._-]{0,79}$/;
const SENSITIVE_AUDIT_KEY = /token|secret|password|cookie|authorization|proof|api[-_]?key|bearer/i;
const ORIGIN_FIELDS = ["kind", "principalId", "grokSessionId", "clientOperationId", "credentialRef"];
const SNAPSHOT_FORMAT = "omnikali-reference-snapshot";
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function sanitizeAudit(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const out = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== "credentialRef" && SENSITIVE_AUDIT_KEY.test(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null) out[key] = value;
  }
  return out;
}

function sanitizeOrigin(origin) {
  if (origin == null) return undefined;
  if (typeof origin !== "object" || Array.isArray(origin)) throw new Error("invalid origin");
  const clean = {};
  for (const key of ORIGIN_FIELDS) {
    if (origin[key] == null) continue;
    if (typeof origin[key] !== "string" || origin[key].length === 0 || origin[key].length > 512) throw new Error("invalid origin");
    clean[key] = origin[key];
  }
  return Object.keys(clean).length ? clean : undefined;
}

function stateForResult(result) {
  if (result.completion === "cancelled" || result.canceled) return "stopped";
  if (result.completion === "indeterminate" || result.interrupted) return "orphaned";
  return result.code === 0 ? "completed" : "failed";
}

const EXECUTION_LEASE_MS = 300000;

function currentExecutionLease(task, lease) {
  return Boolean(
    task?.state === 'running' &&
    task.lease?.lease_status === 'active' &&
    task.lease?.owner_id === lease.owner_id &&
    task.lease?.generation === lease.generation &&
    task.lease?.fencing_token === lease.fencing_token &&
    Number.isFinite(task.lease?.expires_at) &&
    Date.now() < task.lease.expires_at
  );
}

export class ControlPlane {
  constructor(store, executor) { this.store=store; this.executor=executor; this.ownerId=id('owner'); }
  async registerAgent(input) { return this.store.update(s=>{ const existing=Object.values(s.agents).find(a=>a.name===input.name); if(existing)return s; const agentId=input.id||id("agent"); s.agents[agentId]={id:agentId,name:input.name,environment:input.environment,state:"ready",createdAt:now()}; s.events.push(event("agent.registered",s.agents[agentId])); }); }
  async declareResource(input) { return this.store.update(s=>{ const existing=Object.values(s.resources).find(r=>r.agentId===input.agentId&&r.kind===input.kind); if(existing)return s; const resourceId=input.id||id("res"); s.resources[resourceId]={id:resourceId,agentId:input.agentId,kind:input.kind,desired:input.desired||{},state:"declared",createdAt:now()}; s.events.push(event("resource.declared",s.resources[resourceId])); }); }
  async acquireLock(name,owner,ttlMs=300000) { return this.store.update(s=>{ const cur=s.locks[name]; if(cur&&cur.expiresAt>Date.now()&&cur.owner!==owner)throw new Error("lock busy: "+name); s.locks[name]={name,owner,state:"held",acquiredAt:now(),expiresAt:Date.now()+ttlMs}; s.events.push(event("lock.acquired",s.locks[name])); }); }
  async releaseLock(name,owner) { return this.store.update(s=>{ const cur=s.locks[name]; if(!cur)return; if(cur.owner!==owner)throw new Error("lock owner mismatch: "+name); delete s.locks[name]; s.events.push(event("lock.released",{name,owner})); }); }
  async createTask(input) {
    const operationKey = input.operationKey || input.id || id('op');
    const taskId = input.id || id('task');
    const disposition = input.commandDisposition == null
      ? undefined : commandDisposition({ commandDisposition: input.commandDisposition });
    const origin = sanitizeOrigin(input.origin);
    let created = false;
    let selectedId;

    // A transactional store serializes this reservation across processes.
    // An existing operation must never cause a second external dispatch.
    const reserved = await this.store.update(state => {
      const existing = Object.values(state.tasks).find(t => t.operationKey === operationKey);
      if (existing) {
        selectedId = existing.id;
        return;
      }
      created = true;
      selectedId = taskId;
      state.tasks[taskId] = {
        id: taskId, operationKey, agentId: input.agentId,
        command: input.command, cwd: input.cwd, state: 'queued',
        createdAt: now(), execution: null,
        ...(disposition ? { commandDisposition: disposition } : {}),
        ...(origin ? { origin } : {})
      };
      state.events.push(event('task.queued', state.tasks[taskId]));
    });
    if (!created) return reserved.tasks[selectedId];

    let lease;
    const running = await this.store.update(state => {
      const task = state.tasks[taskId];
      if (!task || task.state !== 'queued') {
        throw new Error('task changed before execution ownership acquisition');
      }
      lease = {
        operation_id: operationKey,
        owner_id: this.ownerId,
        generation: 1,
        fencing_token: id('fence'),
        expires_at: Date.now() + EXECUTION_LEASE_MS,
        lease_status: 'active'
      };
      task.lease = lease;
      task.state = 'running';
      task.startedAt = now();
      state.events.push(event('task.started', { taskId, generation: lease.generation }));
    });

    const execution = await this.executor.start(running.tasks[taskId], async result =>
      this.store.update(state => {
        const task = state.tasks[taskId];
        if (!currentExecutionLease(task, lease) || task.execution?.result) return;
        task.execution = { ...(task.execution || {}), result };
        task.state = stateForResult(result);
        task.finishedAt = now();
        task.lease.lease_status = 'finalized';
        state.events.push(event('task.finished', { taskId, state: task.state, result }));
      })
    );

    const saved = await this.store.update(state => {
      const task = state.tasks[taskId];
      if (!task || task.lease?.fencing_token !== lease.fencing_token ||
          task.lease?.generation !== lease.generation) return;
      task.execution = { ...(task.execution || {}), ...execution };
      if (execution.result && currentExecutionLease(task, lease) && !task.finishedAt) {
        task.state = stateForResult(execution.result);
        task.finishedAt = now();
        task.lease.lease_status = 'finalized';
        state.events.push(event('task.finished', {
          taskId, state: task.state, result: execution.result
        }));
      }
    });
    return saved.tasks[taskId];
  }

  async cancelTask(taskId) {
    const state = await this.store.load();
    const task = state.tasks[taskId];
    if (!task) throw new Error('unknown task: ' + taskId);
    const lease = task.lease;
    if (!lease || lease.owner_id !== this.ownerId ||
        !currentExecutionLease(task, lease)) {
      return { acknowledged: false, reason: 'not_current_execution_owner' };
    }
    if (!task.execution?.executionId) {
      return { acknowledged: false, reason: 'not_started' };
    }
    return this.executor.cancel(task.execution.executionId, async result =>
      this.store.update(s => {
        const current = s.tasks[taskId];
        if (!currentExecutionLease(current, lease) || current.execution?.result) return;
        current.execution = {
          ...(current.execution || {}), result,
          cancellation: { requested: true, acknowledged: true, acknowledgedAt: now() }
        };
        current.state = stateForResult(result);
        current.finishedAt = now();
        current.lease.lease_status = 'finalized';
        s.events.push(event('task.cancelled', { taskId, result }));
      })
    );
  }

  async reconcile(staleAfterMs=60000) {
    return this.store.update(s=>{ const cutoff=Date.now()-staleAfterMs;
      for (const t of Object.values(s.tasks)) {
        if (t.state !== 'running') continue;
        const ageExpired = Date.parse(t.startedAt) < cutoff;
        const leaseExpired = t.lease?.expires_at != null && t.lease.expires_at <= Date.now();
        if (!ageExpired && !leaseExpired) continue;
        t.state = 'orphaned';
        t.reconciledAt = now();
        if (t.lease) t.lease.lease_status = 'expired';
        s.events.push(event('task.orphaned', { taskId: t.id }));
      }
      for(const [name,l] of Object.entries(s.locks))if(l.expiresAt<=Date.now()){delete s.locks[name];s.events.push(event("lock.expired",{name,owner:l.owner}));}
    });
  }

  async recordAudit(type, data) {
    if (typeof type !== "string" || !AUDIT_TYPE.test(type)) throw new Error("invalid audit type");
    return this.store.update(s => { s.events.push(event(type, sanitizeAudit(data))); });
  }

  async exportSnapshot() {
    return { format: SNAPSHOT_FORMAT, version: 1, state: await this.store.load() };
  }

  async importSnapshot(snapshot) {
    if (!isPlainObject(snapshot) || snapshot.format !== SNAPSHOT_FORMAT || snapshot.version !== 1) throw new Error("invalid snapshot");
    const raw = JSON.stringify(snapshot);
    if (PRIVATE_KEY.test(raw)) throw new Error("snapshot contains private-key material");
    const state = snapshot.state;
    if (!isPlainObject(state) || state.version !== 1 || !Array.isArray(state.events)) throw new Error("invalid snapshot state");
    for (const key of ["agents", "tasks", "locks", "resources"]) {
      if (!isPlainObject(state[key])) throw new Error("invalid snapshot state");
    }
    const current = await this.store.load();
    const occupied = ["agents", "tasks", "locks", "resources"].some(key => Object.keys(current[key] || {}).length > 0);
    if (occupied) throw new Error("refusing to import over non-empty control plane state");
    await this.store.save({
      version: 1,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      agents: state.agents,
      tasks: state.tasks,
      locks: state.locks,
      resources: state.resources,
      events: state.events
    });
    return this.store.load();
  }
}

export function referenceFingerprint(state) {
  const agents = Object.values(state.agents).map(agent => ({
    name: agent.name,
    environment: agent.environment,
    state: agent.state
  })).sort((a, b) => a.name.localeCompare(b.name));
  const agentName = Object.fromEntries(Object.values(state.agents).map(agent => [agent.id, agent.name]));
  const resources = Object.values(state.resources).map(resource => ({
    kind: resource.kind,
    state: resource.state,
    agent: agentName[resource.agentId] ?? null
  })).sort((a, b) => a.kind.localeCompare(b.kind));
  const tasks = Object.values(state.tasks).map(task => ({
    operationKey: task.operationKey ?? null,
    command: task.command ?? null,
    state: task.state,
    code: task.execution?.result?.code ?? null,
    agent: agentName[task.agentId] ?? null
  })).sort((a, b) => String(a.operationKey).localeCompare(String(b.operationKey)));
  const locks = Object.values(state.locks).map(lock => ({
    name: lock.name,
    owner: lock.owner,
    state: lock.state
  })).sort((a, b) => a.name.localeCompare(b.name));
  return { version: state.version, agents, resources, tasks, locks, eventTypes: state.events.map(item => item.type) };
}
