#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';

function keysOnly(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k=>!names.includes(k))) throw new Error('Invalid configuration fields');
}
function https(value) {const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash||u.search)throw new Error('HTTPS URL required');return u;}
export function validateConfig(c) {
  keysOnly(c,['publicUrl','issuer','jwksUrl','subjects','devices','timeoutMs','maxBodyBytes']);
  const resource=https(c.publicUrl);https(c.issuer);const jwks=https(c.jwksUrl);
  if(resource.pathname!=='/mcp'||jwks.origin!==new URL(c.issuer).origin)throw new Error('Invalid resource or JWKS origin');
  if(!Array.isArray(c.subjects)||!c.subjects.length||c.subjects.some(s=>typeof s!=='string'||!s))throw new Error('Explicit subjects required');
  if(!Array.isArray(c.devices)||!c.devices.length||c.devices.length>32)throw new Error('Devices required');
  const ids=new Set();
  for(const d of c.devices){
    keysOnly(d,['id','command','args','env','tools']);
    if(typeof d.id!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(d.id)||ids.has(d.id))throw new Error('Duplicate/invalid device');ids.add(d.id);
    if(typeof d.command!=='string'||!isAbsolute(d.command))throw new Error('Absolute executable required');
    if(!Array.isArray(d.args)||d.args.some(a=>typeof a!=='string'||a.includes('\0')))throw new Error('Invalid argv');
    if(d.env!==undefined){if(!d.env||typeof d.env!=='object'||Array.isArray(d.env)||Object.values(d.env).some(v=>typeof v!=='string'))throw new Error('Invalid environment');}
    if(!Array.isArray(d.tools)||!d.tools.length||new Set(d.tools).size!==d.tools.length||d.tools.some(t=>typeof t!=='string'||!/^[a-zA-Z0-9_.-]{1,90}$/.test(t)))throw new Error('Explicit tool allowlist required');
  }
  for(const [key,fallback,max] of [['timeoutMs',30000,120000],['maxBodyBytes',65536,1048576]]){const v=c[key]??fallback;if(!Number.isSafeInteger(v)||v<1||v>max)throw new Error('Invalid bound');}
  return c;
}

class Fleet {
  constructor(config){this.config=config;this.clients=new Map();this.transports=new Set();}
  async client(device){
    if(!this.clients.has(device.id))this.clients.set(device.id,(async()=>{
      const env={};for(const key of ['PATH','HOME','USER','LOGNAME','TMPDIR','TEMP','SystemRoot'])if(process.env[key])env[key]=process.env[key];
      const transport=new StdioClientTransport({command:device.command,args:device.args,env:{...env,...device.env},stderr:'ignore',maxBufferSize:1048576});
      this.transports.add(transport);
      const client=new Client({name:'omnikali-remote-ops',version:'0.1.0'});
      await client.connect(transport,{timeout:10000});
      return client;
    })());
    return this.clients.get(device.id);
  }
  async list(){
    const tools=[];
    for(const device of this.config.devices){
      const client=await this.client(device);
      let cursor;let pages=0;
      do {
        if(++pages>10)throw new Error('Tool inventory exceeds limit');
        const page=await client.listTools(cursor?{cursor}:{},{timeout:10000});
        for(const tool of page.tools)if(device.tools.includes(tool.name))tools.push({...tool,name:`${device.id}__${tool.name}`,description:`[${device.id}] ${tool.description??tool.name}`});
        cursor=page.nextCursor;
      }while(cursor);
    }
    if(new Set(tools.map(t=>t.name)).size!==tools.length)throw new Error('Duplicate tool inventory');
    return {tools};
  }
  async call(params){
    const device=this.config.devices.find(d=>params.name.startsWith(`${d.id}__`));
    const name=device?params.name.slice(device.id.length+2):'';
    if(!device||!device.tools.includes(name))throw new McpError(ErrorCode.InvalidParams,'Tool not authorized');
    let client;
    try{client=await this.client(device);}catch{return {isError:true,content:[{type:'text',text:JSON.stringify({status:'UNAVAILABLE',device:device.id})}]};}
    try {
      return await client.callTool({name,arguments:params.arguments??{}},undefined,{timeout:this.config.timeoutMs??30000});
    } catch {
      // A disconnected or timed-out backend may have completed a side effect.
      // Never reconnect and resend an in-flight invocation.
      return {isError:true,content:[{type:'text',text:JSON.stringify({status:'OUTCOME_UNKNOWN',device:device.id,retryAllowed:false})}]};
    }
  }
  async close(){await Promise.allSettled([...this.transports].map(t=>t.close()));}
}

export async function createGateway(input,{jwks, audit=()=>{}}={}){
  const config=validateConfig(input);const publicUrl=new URL(config.publicUrl);
  const keySet=jwks??createRemoteJWKSet(new URL(config.jwksUrl),{timeoutDuration:5000});
  const fleet=new Fleet(config);const active=new Set();let inFlight=0;
  const metadata={resource:config.publicUrl,authorization_servers:[config.issuer],scopes_supported:['remoteops:use'],bearer_methods_supported:['header']};
  const discovery=`${publicUrl.origin}/.well-known/oauth-protected-resource/mcp`;
  function json(res,status,value){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));}
  const server=createServer(async(req,res)=>{
    const requestId=randomUUID();res.setHeader('x-request-id',requestId);
    if(req.headers.host!==publicUrl.host||(req.headers.origin&&req.headers.origin!==publicUrl.origin)){json(res,403,{error:'origin_or_host_rejected'});return;}
    if(req.method==='GET'&&['/.well-known/oauth-protected-resource/mcp','/.well-known/oauth-protected-resource'].includes(req.url)){json(res,200,metadata);return;}
    if(req.url!=='/mcp'){json(res,404,{error:'not_found'});return;}
    let subject;
    try{
      const auth=req.headers.authorization;
      if(typeof auth!=='string'||!auth.startsWith('Bearer ')||auth.length>16384)throw new Error('Unauthorized');
      const {payload}=await jwtVerify(auth.slice(7),keySet,{issuer:config.issuer,audience:config.publicUrl,algorithms:['RS256'],requiredClaims:['exp','iat','sub']});
      if(!config.subjects.includes(payload.sub)||typeof payload.scope!=='string'||!payload.scope.split(' ').includes('remoteops:use'))throw new Error('Unauthorized');
      subject=payload.sub;
    }catch{res.setHeader('www-authenticate',`Bearer resource_metadata="${discovery}"`);json(res,401,{error:'unauthorized'});return;}
    if(req.method!=='POST'){res.setHeader('allow','POST');json(res,405,{error:'method_not_allowed'});return;}
    if((req.headers['content-type']??'').split(';')[0]!=='application/json'){json(res,415,{error:'json_required'});return;}
    if(inFlight>=16){json(res,429,{error:'capacity'});return;}inFlight++;
    try{
      let length=0;const chunks=[];
      for await(const chunk of req){length+=chunk.length;if(length>(config.maxBodyBytes??65536)){json(res,413,{error:'request_too_large'});return;}chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{json(res,400,{error:'invalid_json'});return;}
      const mcp=new Server({name:'omnikali-remote-ops',version:'0.1.0'},{capabilities:{tools:{}}});
      mcp.setRequestHandler(ListToolsRequestSchema,()=>fleet.list());
      mcp.setRequestHandler(CallToolRequestSchema,request=>fleet.call(request.params));
      const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,allowedHosts:[publicUrl.host],allowedOrigins:[publicUrl.origin],enableDnsRebindingProtection:true});
      active.add(transport);
      res.once('close',()=>{active.delete(transport);void mcp.close();});
      await mcp.connect(transport);
      audit({requestId,subject,method:typeof body?.method==='string'?body.method:'invalid'});
      await transport.handleRequest(req,res,body);
    }catch{if(!res.headersSent)json(res,500,{error:'request_failed'});else res.end();}
    finally{inFlight--;}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,async close(){await Promise.allSettled([...active].map(t=>t.close()));await fleet.close();await new Promise(r=>server.close(r));server.closeAllConnections();}};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{
    if(!process.argv[2])throw new Error('Configuration path required');
    const config=JSON.parse(await readFile(process.argv[2],'utf8'));
    const gateway=await createGateway(config,{audit:event=>console.error(JSON.stringify(event))});
    const port=Number(process.env.REMOTE_OPS_PORT??8788);
    if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
    gateway.server.listen(port,'127.0.0.1',()=>console.error(JSON.stringify({status:'LISTENING',host:'127.0.0.1',port,productionVerified:false})));
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void gateway.close();});
  }catch{console.error('Remote operations gateway startup failed; check private configuration.');process.exitCode=1;}
}
