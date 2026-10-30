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

export class ControlPlane {
  constructor(store, executor) { this.store=store; this.executor=executor; }
  async createInstance(input) {
    if (!input || typeof input.name !== "string" || !/^[a-z0-9._-]{1,64}$/.test(input.name)) throw new Error("invalid instance name");
    if (input.mode !== "persistent" && input.mode !== "ephemeral") throw new Error("invalid instance mode");
    return this.store.update(s => {
      const existing = Object.values(s.instances || {}).find(i => i.name === input.name && i.state !== "destroyed");
      if (existing) return s;
      const instanceId = input.id || id("inst");
      s.instances ||= {};
      s.instances[instanceId] = {
        id: instanceId, name: input.name, mode: input.mode,
        kind: input.kind || "workspace", desired: input.desired || {},
        state: "provisioning", createdAt: now()
      };
      s.events.push(event("instance.created", s.instances[instanceId]));
      return s;
    });
  }
  async setInstanceReady(instanceId) {
    return this.store.update(s => {
      const instance = s.instances?.[instanceId];
      if (!instance) throw new Error("unknown instance: " + instanceId);
      if (instance.state === "destroyed") throw new Error("instance destroyed: " + instanceId);
      instance.state = "ready"; instance.readyAt = now();
      s.events.push(event("instance.ready", { instanceId }));
      return s;
    });
  }
  async switchInstance(instanceId) {
    return this.store.update(s => {
      const instance = s.instances?.[instanceId];
      if (!instance || instance.state === "destroyed") throw new Error("unknown or destroyed instance: " + instanceId);
      if (instance.state !== "ready" && instance.state !== "stopped") throw new Error("instance not switchable: " + instanceId);
      s.activeInstanceId = instanceId;
      s.events.push(event("instance.switched", { instanceId }));
      return s;
    });
  }
  async stopInstance(instanceId) {
    return this.store.update(s => {
      const instance = s.instances?.[instanceId];
      if (!instance || instance.state === "destroyed") throw new Error("unknown instance: " + instanceId);
      instance.state = "stopped"; instance.stoppedAt = now();
      if (s.activeInstanceId === instanceId) s.activeInstanceId = null;
      s.events.push(event("instance.stopped", { instanceId }));
      return s;
    });
  }
  async destroyInstance(instanceId) {
    return this.store.update(s => {
      const instance = s.instances?.[instanceId];
      if (!instance) throw new Error("unknown instance: " + instanceId);
      if (instance.mode !== "ephemeral") throw new Error("persistent instance must be stopped, not destroyed");
      instance.state = "destroyed"; instance.destroyedAt = now();
      if (s.activeInstanceId === instanceId) s.activeInstanceId = null;
      s.events.push(event("instance.destroyed", { instanceId, mode: instance.mode }));
      return s;
    });
  }
  async registerAgent(input) { return this.store.update(s=>{ const existing=Object.values(s.agents).find(a=>a.name===input.name); if(existing)return s; const agentId=input.id||id("agent"); s.agents[agentId]={id:agentId,name:input.name,environment:input.environment,state:"ready",createdAt:now()}; s.events.push(event("agent.registered",s.agents[agentId])); }); }
  async declareResource(input) { return this.store.update(s=>{ const existing=Object.values(s.resources).find(r=>r.agentId===input.agentId&&r.kind===input.kind); if(existing)return s; const resourceId=input.id||id("res"); s.resources[resourceId]={id:resourceId,agentId:input.agentId,kind:input.kind,desired:input.desired||{},state:"declared",createdAt:now()}; s.events.push(event("resource.declared",s.resources[resourceId])); }); }
  async acquireLock(name,owner,ttlMs=300000) { return this.store.update(s=>{ const cur=s.locks[name]; if(cur&&cur.expiresAt>Date.now()&&cur.owner!==owner)throw new Error("lock busy: "+name); s.locks[name]={name,owner,state:"held",acquiredAt:now(),expiresAt:Date.now()+ttlMs}; s.events.push(event("lock.acquired",s.locks[name])); }); }
  async releaseLock(name,owner) { return this.store.update(s=>{ const cur=s.locks[name]; if(!cur)return; if(cur.owner!==owner)throw new Error("lock owner mismatch: "+name); delete s.locks[name]; s.events.push(event("lock.released",{name,owner})); }); }
  async createTask(input) {
    const state=await this.store.load();
    const operationKey=input.operationKey||input.id||id("op");
    const existing=Object.values(state.tasks).find(t=>t.operationKey===operationKey);
    if(existing)return existing;

    const taskId=input.id||id("task");
    if (input.instanceId != null && !state.instances?.[input.instanceId]) throw new Error("unknown instance: " + input.instanceId);
    if (input.instanceId != null && state.instances[input.instanceId].state !== "ready") throw new Error("instance not ready: " + input.instanceId);
    const disposition=input.commandDisposition==null?undefined:commandDisposition({commandDisposition:input.commandDisposition});
    const origin=sanitizeOrigin(input.origin);
    state.tasks[taskId]={id:taskId,operationKey,agentId:input.agentId,instanceId:input.instanceId,command:input.command,cwd:input.cwd,state:"queued",createdAt:now(),execution:null,...(disposition?{commandDisposition:disposition}:{}),...(origin?{origin}:{})};
    state.events.push(event("task.queued",state.tasks[taskId]));
    await this.store.save(state);

    await this.store.update(s=>{s.tasks[taskId].state="running";s.tasks[taskId].startedAt=now();});

    const execution=await this.executor.start(state.tasks[taskId],async result=>this.store.update(s=>{
      const t=s.tasks[taskId]; if(!t)return;
      if(t.execution?.result)return;
      t.execution={...(t.execution||{}),result};
      t.state=stateForResult(result);
      t.finishedAt=now();
      s.events.push(event("task.finished",{taskId,state:t.state,result}));
    }));

    const saved=await this.store.update(s=>{
      const t=s.tasks[taskId];
      t.execution={...(t.execution||{}),...execution};
      if(execution.result&&!t.finishedAt){
        t.state=stateForResult(execution.result);
        t.finishedAt=now();
      }
      return t;
    });
    return saved.tasks[taskId];
  }

  async cancelTask(taskId) {
    const state=await this.store.load();
    const task=state.tasks[taskId];
    if(!task) throw new Error("unknown task: "+taskId);
    if(!task.execution?.executionId) return { acknowledged:false, reason:"not_started" };
    return this.executor.cancel(task.execution.executionId,async result=>this.store.update(s=>{
      const t=s.tasks[taskId]; if(!t)return;
      t.execution={...(t.execution||{}),result,cancellation:{requested:true,acknowledged:true,acknowledgedAt:now()}};
      t.state=stateForResult(result);
      t.finishedAt=now();
      s.events.push(event("task.cancelled",{taskId,result}));
    }));
  }

  async reconcile(staleAfterMs=60000) {
    return this.store.update(s=>{ const cutoff=Date.now()-staleAfterMs;
      for(const t of Object.values(s.tasks))if(t.state==="running"&&Date.parse(t.startedAt)<cutoff){t.state="orphaned";t.reconciledAt=now();s.events.push(event("task.orphaned",{taskId:t.id}));}
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
    for (const key of ["agents", "tasks", "locks", "resources", "instances"]) {
      if (!isPlainObject(state[key])) throw new Error("invalid snapshot state");
    }
    const current = await this.store.load();
    const occupied = ["agents", "tasks", "locks", "resources", "instances"].some(key => Object.keys(current[key] || {}).length > 0);
    if (occupied) throw new Error("refusing to import over non-empty control plane state");
    await this.store.save({
      version: 1,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      agents: state.agents,
      tasks: state.tasks,
      locks: state.locks,
      resources: state.resources,
      instances: state.instances,
      activeInstanceId: state.activeInstanceId || null,
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
  const instances = Object.values(state.instances || {}).map(instance => ({
    name: instance.name, mode: instance.mode, kind: instance.kind, state: instance.state
  })).sort((a, b) => a.name.localeCompare(b.name));
  const tasks = Object.values(state.tasks).map(task => ({
    operationKey: task.operationKey ?? null,
    command: task.command ?? null,
    state: task.state,
    code: task.execution?.result?.code ?? null,
    agent: agentName[task.agentId] ?? null,
    instance: state.instances?.[task.instanceId]?.name ?? null
  })).sort((a, b) => String(a.operationKey).localeCompare(String(b.operationKey)));
  const locks = Object.values(state.locks).map(lock => ({
    name: lock.name,
    owner: lock.owner,
    state: lock.state
  })).sort((a, b) => a.name.localeCompare(b.name));
  return { version: state.version, agents, resources, instances, activeInstance: state.instances?.[state.activeInstanceId]?.name ?? null, tasks, locks, eventTypes: state.events.map(item => item.type) };
}
