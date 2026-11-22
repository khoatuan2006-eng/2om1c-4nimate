import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {ExportJobs} from './export-jobs.mjs';
import {removeTestFolder} from './test-runtime.mjs';
import {randomUUID} from 'node:crypto';
import {atomicWriteJson} from './atomic-write.mjs';
import {readProcessIdentity} from './process-identity.mjs';
import {fork} from 'node:child_process';
import {once} from 'node:events';
const project=(id='first',title='fixture')=>({id,title,revision:1,duration:30,sceneOrder:['one'],scenes:[{id:'one',document:{revision:0}}]});
async function fixture(){const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-')),jobs=new ExportJobs({root:join(folder,'exports'),mediaRoot:join(folder,'media'),workerPath:resolve(import.meta.dirname,'test-fixtures/export-process.mjs')});return {folder,jobs,async close(){await jobs.shutdown({timeoutMs:100});await removeTestFolder(folder);}};}
async function rendering(jobs,id){for(let n=0;n<100;n++){const job=await jobs.get(id);if(job.status==='rendering')return job;await delay(20);}throw Error('Fixture worker never started');}
test('replaying an export request returns one durable job across terminal state and a new service',async()=>{
 const f=await fixture(),requestId=randomUUID();try{
  const results=await Promise.all([f.jobs.create(project(),1,requestId),f.jobs.create(project(),1,requestId)]);
  assert.equal(results[0].id,requestId);assert.equal(results[1].id,requestId);assert.equal((await f.jobs.list()).length,1);
  await rendering(f.jobs,requestId);await f.jobs.shutdown();
  const observer=new ExportJobs({root:f.jobs.root,mediaRoot:f.jobs.mediaRoot});
  const replay=await observer.create({...project(),title:'later edits'},1,requestId);
  assert.equal(replay.id,requestId);assert.equal(replay.status,'cancelled');assert.equal(replay.title,'fixture');assert.equal(observer.workers.size,0);
  await assert.rejects(observer.create(project('other'),1,requestId),e=>e.status===409);
  await assert.rejects(observer.create(project(),.5,requestId),e=>e.status===409);
  await assert.rejects(observer.create(project(),1,'bad'),e=>e.status===400);
 }finally{await f.close();}
});
test('failed preparation and an abandoned preparation reservation are never launched again on replay',async()=>{
 const f=await fixture();try{
  const requestId=randomUUID(),broken=project();broken.scenes[0].document.layers={bad:{asset:{parts:[{src:'invalid'}]}}};
  await assert.rejects(f.jobs.create(broken,1,requestId));
  const failed=await f.jobs.create(project(),1,requestId);assert.equal(failed.status,'failed');assert.equal(f.jobs.workers.size,0);
  const orphanId=randomUUID();await atomicWriteJson(join(f.jobs.folder(orphanId),'job.json'),{id:orphanId,requestId:orphanId,projectId:'first',scale:1,status:'preparing',progress:0,createdAt:'2000-01-01T00:00:00.000Z',preparationOwner:{pid:2147483647,birth:'windows:123'}});
  const replay=await f.jobs.create(project(),1,orphanId);assert.equal(replay.status,'failed');assert.match(replay.error,/gián đoạn/);assert.equal(f.jobs.workers.size,0);
 }finally{await f.close();}
});
test('simultaneous export requests reserve one slot across projects; snapshot is detached from edits',async()=>{
 const f=await fixture();try{
  const original=project(),first=f.jobs.create(original,1);original.title='changed after request';
  const duplicate=f.jobs.create(project(),1),other=f.jobs.create(project('second'),1);
  // Attach observers before any of the serialized operations can reject.
  const results=await Promise.allSettled([first,duplicate,other]);assert.equal(results[0].status,'fulfilled');assert.equal(results[1].reason.status,409);assert.equal(results[2].reason.status,429);
  const job=results[0].value,snapshot=JSON.parse(await readFile(join(f.jobs.folder(job.id),'snapshot.json'),'utf8'));assert.equal(snapshot.project.title,'fixture');assert.equal(job.provenance.title,'fixture');assert.equal(job.provenance.purpose,'editor-preview');assert.deepEqual(snapshot.provenance,job.provenance);assert.deepEqual(job.provenance.scenes,[{id:'one',revision:0}]);
  await rendering(f.jobs,job.id);await f.jobs.cancel(job.id);assert.ok(['cancelling','cancelled'].includes((await f.jobs.get(job.id)).status));
  await f.jobs.shutdown();assert.equal((await f.jobs.get(job.id)).status,'cancelled');
  await assert.rejects(()=>f.jobs.create(project('later'),1),error=>error.status===503);
 }finally{await f.close();}
});
test('a restarted observer waits for a live worker; cancellation survives independent observer reads',async()=>{
 const f=await fixture();try{
  const created=await f.jobs.create(project(),.5);await rendering(f.jobs,created.id);
  const observer=new ExportJobs({root:f.jobs.root,mediaRoot:f.jobs.mediaRoot});assert.equal((await observer.get(created.id)).status,'rendering');
  await assert.rejects(()=>observer.create(project('other'),1),error=>error.status===429);
  await observer.cancel(created.id);assert.ok(['cancelling','cancelled'].includes((await observer.get(created.id)).status));
  await f.jobs.shutdown();assert.equal((await observer.get(created.id)).status,'cancelled');
 }finally{await f.close();}
});
test('shutdown confirms a stubborn worker and its descendant have exited before returning',async()=>{
 const f=await fixture();try{
  const created=await f.jobs.create(project('stubborn','ignore-cancel'),1),running=await rendering(f.jobs,created.id);assert.ok(running.grandchildPid);
  await f.jobs.shutdown({timeoutMs:30});assert.equal(f.jobs.workers.size,0);assert.equal((await f.jobs.get(created.id)).status,'cancelled');
  for(let n=0;n<100;n++){try{process.kill(running.grandchildPid,0);}catch(error){if(error.code==='ESRCH')return;throw error;}await delay(20);}
  assert.fail('Export descendant remains alive');
 }finally{await f.close();}
});
test('an abruptly killed worker is recorded failed while its snapshot remains readable',async()=>{
 const f=await fixture();try{
  const created=await f.jobs.create(project(),1);await rendering(f.jobs,created.id);const entry=f.jobs.workers.get(created.id);entry.child.kill();await entry.done;
  assert.equal((await f.jobs.get(created.id)).status,'failed');assert.equal(JSON.parse(await readFile(join(f.jobs.folder(created.id),'snapshot.json'),'utf8')).project.duration,30);
 }finally{await f.close();}
});
test('restarted runtime shutdown requests disk cancellation and waits for the unowned worker to exit',async()=>{
 const f=await fixture();try{
  const created=await f.jobs.create(project(),1);await rendering(f.jobs,created.id);const entry=f.jobs.workers.get(created.id);
  const observer=new ExportJobs({root:f.jobs.root,mediaRoot:f.jobs.mediaRoot});await observer.shutdown({timeoutMs:3000});
  assert.equal(entry.child.exitCode,0);assert.equal((await observer.get(created.id)).status,'cancelled');
 }finally{await f.close();}
});
test('restarted runtime cannot force-kill an unowned worker or report successful shutdown while it is still live',async()=>{
 const f=await fixture();try{
  const created=await f.jobs.create(project('stubborn','ignore-cancel'),1);await rendering(f.jobs,created.id);const entry=f.jobs.workers.get(created.id);
  const observer=new ExportJobs({root:f.jobs.root,mediaRoot:f.jobs.mediaRoot});await assert.rejects(observer.shutdown({timeoutMs:30}),/Giữ khóa dữ liệu/);
  assert.equal(entry.child.exitCode,null);assert.equal(entry.child.signalCode,null);assert.equal((await observer.get(created.id)).status,'cancelling');
 }finally{await f.close();}
});

async function staleJob(jobs,{birth,record=true}={}){
 const id=randomUUID(),folder=jobs.folder(id),workerToken=randomUUID();await mkdir(folder,{recursive:true});
 const job={id,projectId:'previous',status:'rendering',workerPid:process.pid,workerToken,updatedAt:'2000-01-01T00:00:00.000Z'};await atomicWriteJson(join(folder,'job.json'),job);
 if(record)await atomicWriteJson(join(folder,'worker.json'),{pid:process.pid,token:workerToken,birth});return job;
}
test('a reused PID with a different OS birth cannot block the export slot or shutdown and is never killed',async()=>{
 const f=await fixture();try{
  const self=await readProcessIdentity(process.pid);assert.equal(self.state,'alive');const job=await staleJob(f.jobs,{birth:self.birth.replace(/\d+$/,ticks=>String(BigInt(ticks)+1n))});
  const observer=new ExportJobs({root:f.jobs.root,mediaRoot:f.jobs.mediaRoot});assert.equal((await observer.get(job.id)).status,'failed');
  assert.doesNotThrow(()=>process.kill(process.pid,0));const next=await f.jobs.create(project('new'),1);await rendering(f.jobs,next.id);await f.jobs.shutdown();await observer.shutdown();assert.doesNotThrow(()=>process.kill(process.pid,0));
 }finally{await f.close();}
});
test('unreadable generation or legacy live PID stays uncertain and prevents unsafe release',async()=>{
 const f=await fixture();try{
  const job=await staleJob(f.jobs,{birth:'windows:1'}),observer=new ExportJobs({root:f.jobs.root,mediaRoot:f.jobs.mediaRoot,inspectProcess:async pid=>({state:'unknown',pid})});
  const current=await observer.get(job.id);assert.equal(current.status,'rendering');assert.equal(current.errorCode,'WORKER_IDENTITY_UNKNOWN');
  await assert.rejects(observer.create(project('new'),1),error=>error.status===429);await assert.rejects(observer.shutdown({timeoutMs:10}),/Giữ khóa dữ liệu/);assert.doesNotThrow(()=>process.kill(process.pid,0));
  // The fixture PID is this test process, not a real worker; release its slot
  // through explicit fixture terminal data, never by killing an unowned PID.
  await atomicWriteJson(join(f.jobs.folder(job.id),'job.json'),{...job,status:'failed'});
  const legacy=await staleJob(f.jobs,{record:false});assert.equal((await f.jobs.get(legacy.id)).workerState,'unknown');await atomicWriteJson(join(f.jobs.folder(legacy.id),'job.json'),{...legacy,status:'failed'});
  const corrupt=await staleJob(f.jobs,{birth:'malformed-generation'});assert.equal((await f.jobs.get(corrupt.id)).workerState,'unknown');await atomicWriteJson(join(f.jobs.folder(corrupt.id),'job.json'),{...corrupt,status:'failed'});
 }finally{await f.close();}
});
test('a completion arriving during identity inspection cannot be overwritten as an interrupted job',async()=>{
 const f=await fixture();try{
  const job=await staleJob(f.jobs,{birth:'windows:1'}),observer=new ExportJobs({root:f.jobs.root,mediaRoot:f.jobs.mediaRoot,inspectProcess:async pid=>{await atomicWriteJson(join(f.jobs.folder(job.id),'job.json'),{...job,status:'complete',progress:100});return {state:'gone',pid};}});
  assert.equal((await observer.get(job.id)).status,'complete');assert.equal(JSON.parse(await readFile(join(f.jobs.folder(job.id),'job.json'),'utf8')).status,'complete');
 }finally{await f.close();}
});

test('an actual parent exit leaves a verifiable worker; a new observer cancels it and waits for real exit',async()=>{
 const f=await fixture();let child;
 try{
  child=fork(resolve(import.meta.dirname,'test-fixtures/export-parent-exit.mjs'),[f.folder],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});
  const exited=once(child,'exit'),timer=setTimeout(()=>child.kill(),10000);let info;
  try{[info]=await Promise.race([once(child,'message'),exited.then(()=>{throw Error('Parent fixture exited before publishing its worker');})]);await exited;}finally{clearTimeout(timer);}
  assert.equal(child.exitCode,0);assert.equal((await readProcessIdentity(info.workerPid)).state,'alive');
  const observer=new ExportJobs({root:f.jobs.root,mediaRoot:f.jobs.mediaRoot});assert.equal((await observer.get(info.id)).workerState,'alive');
  await observer.shutdown({timeoutMs:3000});assert.equal((await observer.get(info.id)).status,'cancelled');assert.equal((await readProcessIdentity(info.workerPid)).state,'gone');
 }finally{if(child&&child.exitCode===null&&child.signalCode===null){child.kill();await once(child,'exit');}await f.jobs.shutdown({timeoutMs:3000});await f.close();}
});
