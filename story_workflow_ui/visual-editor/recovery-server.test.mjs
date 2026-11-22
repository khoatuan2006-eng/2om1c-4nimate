import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,access,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {ProjectStore} from './project-store.mjs';
import {createBackup,verifyBackup} from './backup-service.mjs';
import {createRecoveryServer} from './recovery-server.mjs';
import {acquireDataLease} from './data-lease.mjs';
import {removeTestFolder} from './test-runtime.mjs';
async function fixture(options={}){const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-')),root=join(folder,'data'),store=new ProjectStore(join(root,'projects.sqlite')),project=store.create('Before backup'),saved=await createBackup(store,root);store.update(project.id,{revision:0,title:'Newer current data'});store.close();const app=await createRecoveryServer({dataDirectory:root,...options}),address=await app.listen(0),base='http://127.0.0.1:'+address.port;return {folder,root,project,saved,app,base,post:(path,body,origin=base)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),async close(){await this.app.close();await removeTestFolder(folder);}};}
async function terminal(f){for(let i=0;i<200;i++){const state=await fetch(f.base+'/api/recovery').then(r=>r.json());if(state.job?.status!=='running'){assert.deepEqual(JSON.parse(await readFile(f.root+'.recovery-job.json','utf8')),state.job);return state.job;}await delay(10);}throw Error('Recovery did not settle');}
test('offline recovery requires verified confirmation, restores whole database, keeps newer data in rollback and deduplicates retries',async()=>{
 const f=await fixture();try{
  await assert.rejects(createRecoveryServer({dataDirectory:f.root}),/phiên khác/);
  const alias=join(f.folder,'alias');await symlink(f.root,alias,process.platform==='win32'?'junction':'dir');await assert.rejects(createRecoveryServer({dataDirectory:alias}),/phiên khác/);
  assert.equal((await f.post('/api/recovery/verify',{id:f.saved.id},'https://evil.example')).status,403);
  assert.equal((await f.post('/api/recovery/verify',{id:'../../escape'})).status,400);
  const plan=await f.post('/api/recovery/verify',{id:f.saved.id}).then(r=>r.json());assert.equal(plan.projects,1);
  assert.equal((await f.post('/api/recovery/restore',{ticket:plan.ticket})).status,400);
  const requests=await Promise.all([f.post('/api/recovery/restore',{ticket:plan.ticket,confirm:true}),f.post('/api/recovery/restore',{ticket:plan.ticket,confirm:true})]);assert.ok(requests.every(r=>[200,202].includes(r.status)));
  const done=await terminal(f);assert.equal(done.status,'complete',JSON.stringify(done));const current=new ProjectStore(join(f.root,'projects.sqlite')),rollback=new ProjectStore(join(done.rollback,'projects.sqlite'));try{assert.equal(current.get(f.project.id).title,'Before backup');assert.equal(rollback.get(f.project.id).title,'Newer current data');}finally{current.close();rollback.close();}
  const retry=await f.post('/api/recovery/restore',{ticket:plan.ticket,confirm:true}).then(r=>r.json());assert.equal(retry.rollback,done.rollback);
 }finally{await f.close();}
});
test('live editor lease prevents restoring; corrupt backup and interrupted journal cannot trigger automatic restore',async()=>{
 const f=await fixture();try{
  const release=acquireDataLease(f.root),plan=await f.post('/api/recovery/verify',{id:f.saved.id}).then(r=>r.json());try{await f.post('/api/recovery/restore',{ticket:plan.ticket,confirm:true});const result=await terminal(f);assert.equal(result.status,'failed');assert.match(result.error,/phiên khác/);}finally{release();}
  const current=new ProjectStore(join(f.root,'projects.sqlite'));try{assert.equal(current.get(f.project.id).title,'Newer current data');}finally{current.close();}
  await writeFile(join(f.saved.folder,'projects.sqlite'),'corrupt');assert.equal((await f.post('/api/recovery/verify',{id:f.saved.id})).status,400);
  await f.app.close();await writeFile(f.root+'.recovery-job.json',JSON.stringify({id:'interrupted-test',status:'running',backupId:f.saved.id}));f.app=await createRecoveryServer({dataDirectory:f.root});const addr=await f.app.listen(0);f.base='http://127.0.0.1:'+addr.port;
  const state=await fetch(f.base+'/api/recovery').then(r=>r.json());assert.equal(state.job.status,'interrupted');assert.equal(JSON.parse(await readFile(f.root+'.recovery-job.json','utf8')).status,'interrupted');
 }finally{await f.close();}
});

test('recovery CLI refuses an invalid port before creating a lease and cleans up on port collision',async()=>{
 const f=await fixture();try{
  for(const port of ['invalid',String(new URL(f.base).port)]){
   const root=join(f.folder,'cli-'+port),child=fork(resolve(import.meta.dirname,'recovery-server.mjs'),[],{windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,EDITOR_DATA_DIR:root,EDITOR_RECOVERY_PORT:port}});let output='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>output+=chunk);
   const timer=setTimeout(()=>child.kill(),5000);try{await once(child,'exit');}finally{clearTimeout(timer);}
   assert.equal(child.exitCode,1,output);assert.match(output,port==='invalid'?/Cổng phục hồi không hợp lệ/:/EADDRINUSE/);
   await assert.rejects(access(root+'.recovery-control/runtime.lock'),error=>error.code==='ENOENT');
   await assert.rejects(access(join(root,'projects.sqlite')),error=>error.code==='ENOENT');
  }
 }finally{await f.close();}
});

test('restore waits for an in-flight backup reader and cannot issue a stale verification ticket during swap',{timeout:10000},async()=>{
 let release,entered,count=0;const gate=new Promise(ok=>release=ok),begun=new Promise(ok=>entered=ok);
 const f=await fixture({verify:async folder=>{const manifest=await verifyBackup(folder);if(++count===2){entered();await gate;}return manifest;}});let blocked;
 try{
  const plan=await f.post('/api/recovery/verify',{id:f.saved.id}).then(r=>r.json());blocked=f.post('/api/recovery/verify',{id:f.saved.id});await begun;
  assert.equal((await f.post('/api/recovery/restore',{ticket:plan.ticket,confirm:true})).status,202);
  assert.equal((await fetch(f.base+'/api/recovery').then(r=>r.json())).job.status,'running');
  const current=new ProjectStore(join(f.root,'projects.sqlite'));try{assert.equal(current.get(f.project.id).title,'Newer current data');}finally{current.close();}
  release();assert.equal((await blocked).status,409);assert.equal((await terminal(f)).status,'complete');
 }finally{release();await blocked?.catch(()=>{});await f.close();}
});
