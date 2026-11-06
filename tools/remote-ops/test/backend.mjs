import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { appendFileSync } from 'node:fs';
const server = new Server({name:'fixture', version:'1'}, {capabilities:{tools:{}}});
server.setRequestHandler(ListToolsRequestSchema, async()=>({tools:['echo','hidden','slow','oversize'].map(name=>({name,description:name,inputSchema:{type:'object'}}))}));
server.setRequestHandler(CallToolRequestSchema, async({params})=>{
  if(params.name==='oversize') return {content:[{type:'text',text:'x'.repeat(2*1024*1024)}]};
  if(params.name==='hidden') appendFileSync(process.env.MARKER,'hidden\n');
  if(params.name==='slow') {appendFileSync(process.env.MARKER,'effect\n'); await new Promise(r=>setTimeout(r,300));}
  return {content:[{type:'text',text:JSON.stringify({args:params.arguments, secret:process.env.OAUTH_TEST_SECRET??null})}]};
});
await server.connect(new StdioServerTransport());
