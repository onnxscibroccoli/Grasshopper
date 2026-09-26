import { event, id, now } from "./model.mjs";

export class ControlPlane {
  constructor(store, executor) { this.store=store; this.executor=executor; }
  async registerAgent(input) { return this.store.update(s=>{ const existing=Object.values(s.agents).find(a=>a.name===input.name); if(existing)return s; const agentId=input.id||id("agent"); s.agents[agentId]={id:agentId,name:input.name,environment:input.environment,state:"ready",createdAt:now()}; s.events.push(event("agent.registered",s.agents[agentId])); }); }
  async declareResource(input) { return this.store.update(s=>{ const existing=Object.values(s.resources).find(r=>r.agentId===input.agentId&&r.kind===input.kind); if(existing)return s; const resourceId=input.id||id("res"); s.resources[resourceId]={id:resourceId,agentId:input.agentId,kind:input.kind,desired:input.desired||{},state:"declared",createdAt:now()}; s.events.push(event("resource.declared",s.resources[resourceId])); }); }
  async acquireLock(name,owner,ttlMs=300000) { return this.store.update(s=>{ const cur=s.locks[name]; if(cur&&cur.expiresAt>Date.now()&&cur.owner!==owner)throw new Error("lock busy: "+name); s.locks[name]={name,owner,state:"held",acquiredAt:now(),expiresAt:Date.now()+ttlMs}; s.events.push(event("lock.acquired",s.locks[name])); }); }
  async releaseLock(name,owner) { return this.store.update(s=>{ const cur=s.locks[name]; if(!cur)return; if(cur.owner!==owner)throw new Error("lock owner mismatch: "+name); delete s.locks[name]; s.events.push(event("lock.released",{name,owner})); }); }
  async createTask(input) {
    const state=await this.store.load(); const taskId=input.id||id("task");
    state.tasks[taskId]={id:taskId,agentId:input.agentId,command:input.command,cwd:input.cwd,state:"queued",createdAt:now(),execution:null}; state.events.push(event("task.queued",state.tasks[taskId])); await this.store.save(state);
    await this.store.update(s=>{s.tasks[taskId].state="running";s.tasks[taskId].startedAt=now();});
    const execution=await this.executor.start(state.tasks[taskId],result=>this.store.update(s=>{const t=s.tasks[taskId];if(!t)return;t.pendingResult=result;if(t.execution)t.execution.result=result;t.state=result.code===0?"completed":"failed";t.finishedAt=now();s.events.push(event("task.finished",{taskId,state:t.state,result}));}));
    return this.store.update(s=>{const t=s.tasks[taskId];t.execution=execution;if(execution.result){t.state=execution.result.code===0?"completed":"failed";t.finishedAt=now();}if(t.pendingResult&&!t.execution.result)t.execution.result=t.pendingResult;delete t.pendingResult;return s;});
  }
  async reconcile(staleAfterMs=60000) {
    return this.store.update(s=>{ const cutoff=Date.now()-staleAfterMs;
      for(const t of Object.values(s.tasks))if(t.state==="running"&&Date.parse(t.startedAt)<cutoff){t.state="orphaned";t.reconciledAt=now();s.events.push(event("task.orphaned",{taskId:t.id}));}
      for(const [name,l] of Object.entries(s.locks))if(l.expiresAt<=Date.now()){delete s.locks[name];s.events.push(event("lock.expired",{name,owner:l.owner}));}
    });
  }
}
