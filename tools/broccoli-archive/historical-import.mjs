#!/usr/bin/env node
/**
 * Recover the historical Broccoli archive model without requiring a sample export.
 * Inputs: Broccoli text/bundle artifacts, ChatGPT-style mapping JSON, generic message JSON.
 * Raw source files are never modified.
 */
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { PageJournal } from './page-journal.mjs';

const sha256=s=>createHash('sha256').update(s).digest('hex');
const root=process.env.BROCCOLI_ARCHIVE_ROOT || './archive-journal';

function normalizeMessage(raw,{provider,accountId,conversationId,projectId,sourceHash,idx}){
  const content=typeof raw?.content==='string' ? raw.content :
    Array.isArray(raw?.content) ? raw.content.map(x=>typeof x==='string'?x:(x?.text||'')).join('\n') :
    String(raw?.text ?? raw?.message ?? '');
  if(!content.trim()) return null;
  const role=String(raw?.role ?? raw?.author?.role ?? raw?.sender ?? (idx%2?'assistant':'user')).toLowerCase();
  return {
    message_id:String(raw?.id ?? raw?.message_id ?? conversationId+'-m'+idx),
    conversation_id:conversationId,
    role,
    author:typeof raw?.author==='string'?raw.author:null,
    timestamp:raw?.timestamp ?? raw?.create_time ?? raw?.created_at ?? new Date().toISOString(),
    content,
    content_hash:sha256(content),
    protected:false,
    quarantine_ref:null,
    metadata:{provider,account_id:accountId,project_id:projectId||null,source_hash:sourceHash}
  };
}

function fromChatGPT(obj,meta){
  const convId=String(obj.id ?? obj.conversation_id ?? sha256(JSON.stringify(obj)).slice(0,16));
  const out=[];
  for(const node of Object.values(obj.mapping||{})){
    const msg=node?.message; if(!msg) continue;
    const c=msg.content;
    const text=typeof c?.parts?.[0]==='string'?c.parts.join('\n'):c?.text||'';
    const m=normalizeMessage({...msg,content:text},{...meta,conversationId:convId,idx:out.length});
    if(m) out.push(m);
  }
  return {conversationId:convId,messages:out,title:obj.title||''};
}

function fromGeneric(obj,meta){
  const convId=String(obj.conversation_id ?? obj.id ?? sha256(JSON.stringify(obj)).slice(0,16));
  const arr=Array.isArray(obj.messages)?obj.messages:(Array.isArray(obj.data?.messages)?obj.data.messages:[]);
  return {conversationId:convId,messages:arr.map((m,i)=>normalizeMessage(m,{...meta,conversationId:convId,idx:i})).filter(Boolean),title:obj.title||''};
}

function fromText(text,meta){
  const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const convId=sha256(text).slice(0,16);
  return {conversationId:convId,messages:lines.map((line,i)=>normalizeMessage({text:line,role:i%2?'assistant':'user'},{...meta,conversationId:convId,idx:i})).filter(Boolean),title:basename(meta.source)};
}

const file=process.argv[2];
if(!file){console.error('usage: historical-import.mjs <file> [provider] [account] [project]');process.exit(2);}
const raw=await readFile(file,'utf8');
const sourceHash=sha256(raw);
const provider=process.argv[3]||'other';
const accountId=process.argv[4]||'unknown';
const projectId=process.argv[5]||null;
let parsed=null; try{parsed=JSON.parse(raw);}catch{}
const meta={provider,accountId,projectId,sourceHash,source:file};
const data=parsed?.mapping ? fromChatGPT(parsed,meta) : parsed ? fromGeneric(parsed,meta) : fromText(raw,meta);
const journal=new PageJournal(root);
let pageId=await journal.resumeFrom();
const pageSize=Number(process.env.BROCCOLI_PAGE_SIZE||50);
let batch=[];
for(const m of data.messages){
  batch.push(m);
  if(batch.length>=pageSize){
    await journal.commitPage(pageId++,batch,file,{conversationId:data.conversationId,sourceHash});
    batch=[];
  }
}
if(batch.length) await journal.commitPage(pageId++,batch,file,{conversationId:data.conversationId,sourceHash});
console.log(JSON.stringify({ok:true,provider,accountId,projectId,conversationId:data.conversationId,title:data.title,messageCount:data.messages.length,sourceHash,nextPage:pageId},null,2));
