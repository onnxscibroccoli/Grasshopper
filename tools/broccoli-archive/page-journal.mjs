/**
 * Crash-safe page journal for Broccoli chat archive.
 * Raw pages are durable source. SQLite/FTS is derived.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, rename, appendFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_ROOT = process.env.BROCCOLI_ARCHIVE_ROOT || './archive-journal';
const sha256 = data => createHash('sha256').update(typeof data === 'string' ? data : JSON.stringify(data)).digest('hex');

export class PageJournal {
  constructor(root = DEFAULT_ROOT) {
    this.root=root; this.pagesDir=join(root,'pages');
    this.checkpointPath=join(root,'checkpoint.json'); this.journalPath=join(root,'journal.jsonl');
  }
  async ensure(){ await mkdir(this.pagesDir,{recursive:true}); }
  async event(state,pageId,extra={}) {
    await appendFile(this.journalPath,JSON.stringify({ts:new Date().toISOString(),state,page_id:pageId,...extra})+'\n','utf8');
  }
  async readCheckpoint(){
    try{return JSON.parse(await readFile(this.checkpointPath,'utf8'));}
    catch{return {last_page_id:-1,last_hash:null,updated_at:null,resume_token:null};}
  }
  async commitPage(pageId,messages,source='unknown',metadata={}) {
    await this.ensure();
    const committedAt=new Date().toISOString();
    const page={schema_version:'chat-archive/page-v2',page_id:pageId,checkpoint_id:'ckpt-'+pageId,
      messages,committed_at:committedAt,page_hash:'',source,metadata};
    page.page_hash=sha256(page);
    await this.event('STARTED',pageId,{source,message_count:messages.length,source_hash:metadata.sourceHash||null});
    const tmp=join(this.pagesDir,'page-'+pageId+'.json.tmp');
    const final=join(this.pagesDir,'page-'+pageId+'.json');
    await writeFile(tmp,JSON.stringify(page,null,2),'utf8');
    await rename(tmp,final);
    const ckpt={last_page_id:pageId,last_hash:page.page_hash,updated_at:committedAt,
      source,resume_token:metadata.resumeToken||String(pageId+1)};
    const ckptTmp=this.checkpointPath+'.tmp';
    await writeFile(ckptTmp,JSON.stringify(ckpt,null,2),'utf8');
    await rename(ckptTmp,this.checkpointPath);
    await this.event('COMMITTED',pageId,{page_hash:page.page_hash});
    return page;
  }
  async resumeFrom(){const ckpt=await this.readCheckpoint();return Number(ckpt.last_page_id??-1)+1;}
  async verifyPage(pageId){
    const raw=await readFile(join(this.pagesDir,'page-'+pageId+'.json'),'utf8');
    const page=JSON.parse(raw),expected=page.page_hash,copy={...page,page_hash:''},actual=sha256(copy);
    return {ok:actual===expected,pageId,expected,actual};
  }
}
if(import.meta.url==='file://'+process.argv[1]){
  const j=new PageJournal();
  console.log(JSON.stringify({next_page:await j.resumeFrom(),checkpoint:await j.readCheckpoint()},null,2));
}
