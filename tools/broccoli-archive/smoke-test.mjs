#!/usr/bin/env node
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PageJournal } from './page-journal.mjs';

const root=await mkdtemp(join(tmpdir(),'broccoli-archive-'));
process.env.BROCCOLI_ARCHIVE_ROOT=root;
const j=new PageJournal(root);
await j.commitPage(0,[{
  message_id:'m0',conversation_id:'c0',role:'user',timestamp:new Date().toISOString(),
  content:'Rish transport is proven',content_hash:'demo',protected:false,
  metadata:{provider:'xai',account_id:'acct-demo',project_id:'p0'}
}],'smoke',{sourceHash:'demo'});
await j.commitPage(1,[{
  message_id:'m1',conversation_id:'c0',role:'assistant',timestamp:new Date().toISOString(),
  content:'secret=DO_NOT_INDEX_THIS',content_hash:'demo2',protected:false,
  metadata:{provider:'xai',account_id:'acct-demo',project_id:'p0'}
}],'smoke',{sourceHash:'demo2'});
const v0=await j.verifyPage(0),v1=await j.verifyPage(1);
const ck=await j.readCheckpoint();
const py=spawnSync('python3',['./tools/broccoli-archive/sqlite-index.py'],{
  cwd:process.cwd(),env:{...process.env,BROCCOLI_ARCHIVE_ROOT:root},encoding:'utf8'
});
if(py.status!==0) throw new Error(py.stderr||'indexer failed');
const result={ok:v0.ok&&v1.ok&&ck.last_page_id===1,indexer:JSON.parse(py.stdout),checkpoint:ck};
console.log(JSON.stringify(result,null,2));
await rm(root,{recursive:true,force:true});
if(!result.ok) process.exit(1);
