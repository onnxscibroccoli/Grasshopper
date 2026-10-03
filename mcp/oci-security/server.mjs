#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const VERSION = "grasshopper-oci-security-mcp/v1";
const AUDIT_DIR = process.env.GRASSHOPPER_OCI_AUDIT_DIR || path.join(os.homedir(), ".grasshopper", "audit", "oci-security");
const SSH_HOST = process.env.GRASSHOPPER_OCI_SSH_HOST || "";
const SSH_USER = process.env.GRASSHOPPER_OCI_SSH_USER || "";
const SSH_KEY = process.env.GRASSHOPPER_OCI_SSH_KEY || "";
const SSH_KNOWN_HOSTS = process.env.GRASSHOPPER_OCI_KNOWN_HOSTS || path.join(os.homedir(), ".ssh", "known_hosts");
const CONNECT_TIMEOUT = Number(process.env.GRASSHOPPER_OCI_CONNECT_TIMEOUT || 10);
const LOCAL_MODE = process.env.GRASSHOPPER_OCI_LOCAL === "1";

fs.mkdirSync(AUDIT_DIR, { recursive: true, mode: 0o700 });

const ACTIONS = {
  status: { command: "sudo -n systemctl --failed --no-pager; printf '\\n--- LISTEN ---\\n'; sudo -n ss -lntup", write: false },
  firewall_status: { command: "sudo -n firewall-cmd --state; sudo -n firewall-cmd --get-active-zones; sudo -n firewall-cmd --list-all", write: false },
  ssh_hardening_check: { command: "sudo -n sshd -T | grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication|x11forwarding|allowtcpforwarding|gatewayports|clientaliveinterval|clientalivecountmax) '", write: false },
  security_updates: { command: "sudo -n dnf -q check-update --security || test $? -eq 100", write: false },
  fail2ban_status: { command: "sudo -n systemctl is-enabled fail2ban 2>/dev/null; sudo -n systemctl is-active fail2ban 2>/dev/null; sudo -n fail2ban-client status 2>/dev/null || true", write: false },
  audit_tail: { command: "sudo -n journalctl --since '24 hours ago' -p warning..alert --no-pager -n 200", write: false },
  security_updates_apply: { command: "sudo -n dnf -y update --security", write: true },
  fail2ban_restart: { command: "sudo -n systemctl restart fail2ban", write: true }
};

function audit(entry) {
  const file = path.join(AUDIT_DIR, new Date().toISOString().replaceAll(":", "-") + ".json");
  fs.writeFileSync(file, JSON.stringify({ version: VERSION, host: SSH_HOST, ...entry }, null, 2) + "\n", { mode: 0o600 });
}
function fail(id, message) {
  return { jsonrpc: "2.0", id, error: { code: -32000, message } };
}
function ok(id, result) { return { jsonrpc: "2.0", id, result }; }

async function ssh(command) {
  if (LOCAL_MODE) {
    return await new Promise((resolve,reject)=>{
      const p=spawn("bash",["-lc",command],{stdio:["ignore","pipe","pipe"]});
      let out="",err=""; p.stdout.on("data",d=>out+=d); p.stderr.on("data",d=>err+=d);
      p.on("error",reject); p.on("close",code=>resolve({code,stdout:out,stderr:err}));
    });
  }
  if (!SSH_HOST || !SSH_USER || !SSH_KEY) throw new Error("OCI SSH target is not configured");
  if (!fs.existsSync(SSH_KEY)) throw new Error("OCI SSH identity file does not exist");
  if (!fs.existsSync(SSH_KNOWN_HOSTS)) throw new Error("OCI SSH known_hosts file does not exist");
  const args = [
    "-o","BatchMode=yes","-o","StrictHostKeyChecking=yes",
    "-o","UserKnownHostsFile=" + SSH_KNOWN_HOSTS,
    "-o","ConnectTimeout=" + CONNECT_TIMEOUT,
    "-o","ForwardAgent=no","-o","ClearAllForwardings=yes",
    "-i",SSH_KEY,SSH_USER + "@" + SSH_HOST, "bash","-lc",command
  ];
  return await new Promise((resolve,reject)=>{
    const p=spawn("ssh",args,{stdio:["ignore","pipe","pipe"]});
    let out="",err=""; p.stdout.on("data",d=>out+=d); p.stderr.on("data",d=>err+=d);
    p.on("error",reject); p.on("close",code=>resolve({code,stdout:out,stderr:err}));
  });
}

const tools = Object.entries(ACTIONS).map(([name,a])=>({
  name: "oci_" + name,
  description: a.write ? "Apply one narrowly-scoped OCI workstation security action. Writes an audit record and never accepts arbitrary shell." : "Read-only OCI workstation security inspection.",
  inputSchema: { type:"object", properties:{ confirm:{type:"boolean",description:"Required true for write actions."}}, additionalProperties:false }
}));

async function handle(msg) {
  if (msg.method === "initialize") return ok(msg.id,{protocolVersion:"2024-11-05",capabilities:{tools:{}},serverInfo:{name:"grasshopper-oci-security",version:"1.0.0"}});
  if (msg.method === "notifications/initialized") return null;
  if (msg.method === "tools/list") return ok(msg.id,{tools});
  if (msg.method !== "tools/call") return fail(msg.id,"Unsupported MCP method");
  const name=msg.params?.name||"";
  const action=name.replace(/^oci_/,"");
  if (!Object.hasOwn(ACTIONS,action)) return fail(msg.id,"Action is not allowlisted");
  const args=msg.params?.arguments||{};
  if (ACTIONS[action].write && args.confirm !== true) return fail(msg.id,"Write action requires confirm=true");
  const started=Date.now();
  const result=await ssh(ACTIONS[action].command);
  audit({action,write:ACTIONS[action].write,exitCode:result.code,durationMs:Date.now()-started});
  return ok(msg.id,{content:[{type:"text",text:JSON.stringify({action,exitCode:result.code,stdout:result.stdout,stderr:result.stderr},null,2)}],isError:result.code!==0});
}

let buffer="";
process.stdin.setEncoding("utf8");
process.stdin.on("data",async chunk=>{
  buffer+=chunk;
  let nl;
  while((nl=buffer.indexOf("\n"))>=0){
    const line=buffer.slice(0,nl); buffer=buffer.slice(nl+1);
    if(!line.trim()) continue;
    try { const response=await handle(JSON.parse(line)); if(response) process.stdout.write(JSON.stringify(response)+"\n"); }
    catch(e){ const id=(()=>{try{return JSON.parse(line).id}catch{return null}})(); process.stdout.write(JSON.stringify(fail(id,e.message))+"\n"); }
  }
});
