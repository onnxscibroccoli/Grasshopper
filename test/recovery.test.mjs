import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateStore } from "../src/store.mjs";
import { emptyState } from "../src/model.mjs";
import { ControlPlane } from "../src/control-plane.mjs";
import { DeterministicExecutor } from "../src/executor.mjs";

test("state survives process restart",async()=>{const d=await mkdtemp(join(tmpdir(),"omnikali-"));const p=join(d,"state.json");const a=new StateStore(p);const s=emptyState();s.agents.a={id:"a",state:"ready"};await a.save(s);const b=new StateStore(p);assert.equal((await b.load()).agents.a.state,"ready");await rm(d,{recursive:true,force:true});});

test("expired lock is reclaimed",async()=>{const d=await mkdtemp(join(tmpdir(),"omnikali-"));const store=new StateStore(join(d,"state.json"));await store.update(s=>{s.locks.work={name:"work",owner:"dead",state:"held",expiresAt:Date.now()-1};});const cp=new ControlPlane(store,new DeterministicExecutor());await cp.reconcile();assert.equal((await store.load()).locks.work,undefined);await rm(d,{recursive:true,force:true});});

test("running task becomes orphaned after stale threshold",async()=>{const d=await mkdtemp(join(tmpdir(),"omnikali-"));const store=new StateStore(join(d,"state.json"));await store.update(s=>{s.tasks.t={id:"t",state:"running",startedAt:new Date(Date.now()-10000).toISOString()};});const cp=new ControlPlane(store,new DeterministicExecutor());await cp.reconcile(1000);assert.equal((await store.load()).tasks.t.state,"orphaned");await rm(d,{recursive:true,force:true});});

test("deterministic execution records completion",async()=>{const d=await mkdtemp(join(tmpdir(),"omnikali-"));const store=new StateStore(join(d,"state.json"));const cp=new ControlPlane(store,new DeterministicExecutor());await cp.registerAgent({name:"a",environment:"local"});const agentId=Object.keys((await store.load()).agents)[0];await cp.createTask({agentId,command:"ok: reproducible"});await new Promise(r=>setTimeout(r,10));assert.equal((await store.load()).tasks[Object.keys((await store.load()).tasks)[0]].state,"completed");await rm(d,{recursive:true,force:true});});


test("lock contention rejects a different owner",async()=>{const d=await mkdtemp(join(tmpdir(),"omnikali-"));const store=new StateStore(join(d,"state.json"));const cp=new ControlPlane(store,new DeterministicExecutor());await cp.acquireLock("work","owner-a",10000);await assert.rejects(()=>cp.acquireLock("work","owner-b",10000),/lock busy/);await rm(d,{recursive:true,force:true});});
