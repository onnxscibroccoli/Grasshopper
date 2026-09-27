import { event, id, now } from "./model.mjs";
import { commandDisposition } from "./executor-contract.mjs";

const AUDIT_TYPE = /^[a-z][a-z0-9._-]{0,79}$/;
const SENSITIVE_AUDIT_KEY = /token|secret|password|cookie|authorization|proof|api[-_]?key|bearer/i;
const ORIGIN_FIELDS = ["kind", "principalId", "grokSessionId", "clientOperationId", "credentialRef"];

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
    const disposition=input.commandDisposition==null?undefined:commandDisposition({commandDisposition:input.commandDisposition});
    const origin=sanitizeOrigin(input.origin);
    state.tasks[taskId]={id:taskId,operationKey,agentId:input.agentId,command:input.command,cwd:input.cwd,state:"queued",createdAt:now(),execution:null,...(disposition?{commandDisposition:disposition}:{}),...(origin?{origin}:{})};
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
}
