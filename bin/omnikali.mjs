#!/usr/bin/env node
import { mkdir, readFile } from "node:fs/promises";
import { StateStore } from "../src/store.mjs";
import { ControlPlane } from "../src/control-plane.mjs";
import { createExecutor } from "../src/executor.mjs";

const root=new URL("../",import.meta.url).pathname; const statePath=root+".state/omnikali.json";
const env=JSON.parse(await readFile(root+"environments/local.json","utf8")); await mkdir(root+".state",{recursive:true});
const cp=new ControlPlane(new StateStore(statePath),createExecutor(env.execution));
const [cmd,...args]=process.argv.slice(2);

if(cmd==="status"){console.log(JSON.stringify(await cp.store.load(),null,2));process.exit(0);}
if(cmd==="agent"){console.log(JSON.stringify(await cp.registerAgent({name:args[0]||"reference-agent",environment:env.name}),null,2));process.exit(0);}
if(cmd==="resource"){const s=await cp.store.load();const agentId=Object.keys(s.agents)[0];if(!agentId)throw new Error("register an agent first");console.log(JSON.stringify(await cp.declareResource({agentId,kind:args[0]||"workspace"}),null,2));process.exit(0);}
if(cmd==="task"){const s=await cp.store.load();const agentId=Object.keys(s.agents)[0];if(!agentId)throw new Error("register an agent first");console.log(JSON.stringify(await cp.createTask({agentId,command:args.join(" "),cwd:root}),null,2));process.exit(0);}
if(cmd==="reconcile"){console.log(JSON.stringify(await cp.reconcile(env.recovery.staleTaskAfterMs),null,2));process.exit(0);}
console.error("usage: status | agent [name] | resource [kind] | task <command> | reconcile");process.exit(2);
