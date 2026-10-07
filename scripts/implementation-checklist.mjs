#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const file=path.join(root,"docs/implementation/BIDIRECTIONAL_SCREEN_CONTROL_STATE.json");
const state=JSON.parse(fs.readFileSync(file,"utf8"));
for(let i=0;i<state.stages.length;i++){
 const stage=state.stages[i];
 if(i===0){if(stage.status==="locked")throw new Error("Stage 0 cannot be locked");continue;}
 const previous=state.stages[i-1];
 if(previous.status==="complete"&&stage.status==="locked")stage.status="pending";
 if(previous.status!=="complete"&&stage.status==="pending")throw new Error("Stage "+stage.id+" is pending before Stage "+previous.id+" is complete");
}
state.current_stage=state.stages.find(s=>s.status==="pending")?.id??7;
fs.writeFileSync(file,JSON.stringify(state,null,2)+"\n");
console.log(JSON.stringify({status:"PASS",current_stage:state.current_stage,next:state.stages.find(s=>s.status==="pending")?.name??"continuous-development",doorway_rule:state.rule},null,2));
