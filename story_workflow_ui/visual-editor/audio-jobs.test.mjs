import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {AudioJobs} from './audio-jobs.mjs';
import {atomicWriteJson} from './atomic-write.mjs';
import {buildAudioTimeline} from './created-scenes-server.mjs';
import {removeTestFolder} from './test-runtime.mjs';
const draft=()=>({id:randomUUID(),projectId:'fixture',lines:['one','two'],voiceId:'fixture-voice',cues:[],status:'queued'});
async function fixture(options){const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));const jobs=new AudioJobs({root:join(folder,'jobs'),owner:{pid:process.pid,token:'test'},isOwnerAlive:async()=>false,timing:buildAudioTimeline,...options});return {jobs,async close(){await jobs.drain();await removeTestFolder(folder);}};}
test('simultaneous duplicate requests generate each cue once and measure contiguous timing',async()=>{
 let calls=0;const f=await fixture({generate:async cue=>({...cue,durationSec:++calls===1?1.001:2.2})});try{const job=draft();await Promise.all([f.jobs.enqueue(job),f.jobs.enqueue(job)]);await f.jobs.drain();const result=await f.jobs.get(job.id);assert.equal(result.status,'complete');assert.equal(calls,2);assert.equal(result.duration,97);assert.deepEqual(result.cues.map(c=>[c.from,c.to]),[[0,31],[31,97]]);}finally{await f.close();}
});
test('provider failure preserves completed cues; explicit retry resumes only missing cues',async()=>{
 const calls=[];let fail=true;const f=await fixture({generate:async cue=>{calls.push(cue.text);if(cue.text==='two'&&fail){fail=false;throw Object.assign(Error('provider result unknown'),{code:'TTS_TIMEOUT',retryable:false});}return {...cue,durationSec:1};}});
 try{const job=draft();await f.jobs.enqueue(job);await f.jobs.drain();let result=await f.jobs.get(job.id);assert.equal(result.status,'failed');assert.equal(result.retryable,false);assert.equal(result.cues.length,1);await f.jobs.enqueue(job);await f.jobs.drain();result=await f.jobs.get(job.id);assert.equal(result.status,'complete');assert.equal(result.attempt,2);assert.deepEqual(calls,['one','two','two']);}finally{await f.close();}
});
test('cancellation during an in-flight cue retains that cue and never starts the next one',async()=>{
 let release,started;const gate=new Promise(ok=>release=ok),begun=new Promise(ok=>started=ok);let calls=0;
 const f=await fixture({generate:async cue=>{calls++;started();await gate;return {...cue,durationSec:1};}});
 try{const job=draft();await f.jobs.enqueue(job);await begun;assert.equal((await f.jobs.cancel(job.id)).status,'cancelling');release();await f.jobs.drain();const result=await f.jobs.get(job.id);assert.equal(result.status,'cancelled');assert.equal(result.cues.length,1);assert.equal(calls,1);}finally{release();await f.close();}
});
test('a stopped owner is interrupted; a verified live owner is not falsely restarted',async()=>{
 let calls=0;const f=await fixture({generate:async cue=>{calls++;return {...cue,durationSec:1};}});
 try{const job={...draft(),status:'running',ownerPid:99999999,ownerToken:'stopped'};await atomicWriteJson(f.jobs.path(job.id),job);assert.equal((await f.jobs.get(job.id)).status,'interrupted');f.jobs.isOwnerAlive=async()=>true;await atomicWriteJson(f.jobs.path(job.id),job);assert.equal((await f.jobs.get(job.id)).status,'running');await f.jobs.enqueue(job);assert.equal(calls,0);}finally{await f.close();}
});
test('bounded queue rejects overload and conflicting duplicate input',async()=>{
 let release;const gate=new Promise(ok=>release=ok);const f=await fixture({maxPending:1,generate:async cue=>{await gate;return {...cue,durationSec:1};}});
 try{const job=draft();await f.jobs.enqueue(job);await assert.rejects(()=>f.jobs.enqueue(draft()),error=>error.status===429);await assert.rejects(()=>f.jobs.enqueue({...job,lines:['different']}),error=>error.status===409);}finally{release();await f.close();}
});
test('a disk-write failure is surfaced rather than leaving an apparently running job forever',async()=>{
 const f=await fixture({generate:async cue=>({...cue,durationSec:1}),persist:async(file,value)=>{if(value.status==='complete'||value.status==='failed')throw Object.assign(Error('disk full'),{code:'ENOSPC'});return atomicWriteJson(file,value);}});
 try{const job=draft();await f.jobs.enqueue(job);await f.jobs.drain();const result=await f.jobs.get(job.id);assert.equal(result.status,'failed');assert.equal(result.errorCode,'JOB_WRITE_FAILED');assert.match(result.error,/dung lượng/);assert.equal(result.retryable,true);assert.equal(result.cues.length,2);assert.doesNotThrow(()=>JSON.stringify(result));}finally{await f.close();}
});
test('shutdown finishes the current cue, skips queued cues and refuses new requests',{timeout:10000},async()=>{
 let release,started,cancelled,firstId;const gate=new Promise(ok=>release=ok),begun=new Promise(ok=>started=ok),cancellationSaved=new Promise(ok=>cancelled=ok);const calls=[];
 const f=await fixture({generate:async cue=>{calls.push(cue.cueId);started();await gate;return {...cue,durationSec:1};},persist:async(file,value)=>{await atomicWriteJson(file,value);if(value.id===firstId&&value.status==='cancelling')cancelled();}});
 try{
  const first=draft(),second=draft();firstId=first.id;await f.jobs.enqueue(first);await begun;await f.jobs.enqueue(second);
  const stop=f.jobs.shutdown();assert.equal(stop,f.jobs.shutdown());
  // Observe the real completed write, without repeatedly opening the file in
  // a tight loop that can starve Windows atomic rename. Also observe rejection
  // immediately so a failed shutdown cannot leave this test waiting forever.
  await Promise.race([cancellationSaved,stop.then(()=>{throw Error('Shutdown ended before cancellation was saved');})]);
  await assert.rejects(()=>f.jobs.enqueue(draft()),error=>error.status===503);
  assert.equal((await f.jobs.read(first.id)).status,'cancelling');
  release();assert.equal((await stop).drained,true);
  assert.equal((await f.jobs.get(first.id)).cues.length,1);
  assert.equal((await f.jobs.get(second.id)).status,'cancelled');assert.equal(calls.length,1);
 }finally{release();await f.close();}
});
test('shutdown timeout records unknown outcome and a late result cannot overwrite a new owner',async()=>{
 let release,started;const gate=new Promise(ok=>release=ok),begun=new Promise(ok=>started=ok);
 const f=await fixture({generate:async cue=>{started();await gate;return {...cue,durationSec:1};}});
 try{
  const job=draft();await f.jobs.enqueue(job);await begun;
  const result=await f.jobs.shutdown({timeoutMs:10});assert.equal(result.drained,false);assert.deepEqual(result.interrupted,[job.id]);
  const interrupted=await f.jobs.get(job.id);assert.equal(interrupted.status,'interrupted');assert.equal(interrupted.retryable,false);assert.equal(interrupted.cues.length,0);
  // Model a restarted owner writing its completed retry to the same job file.
  const replacement={...interrupted,status:'complete',ownerToken:'replacement',attempt:2,cues:[{durationSec:4}]};
  await atomicWriteJson(f.jobs.path(job.id),replacement);release();await f.jobs.drain();
  assert.deepEqual(await f.jobs.read(job.id),replacement);
 }finally{release();await f.close();}
});
test('a late provider rejection cannot change the interrupted shutdown state',async()=>{
 let reject,started;const gate=new Promise((_,fail)=>reject=fail),begun=new Promise(ok=>started=ok);
 const f=await fixture({generate:async()=>{started();return gate;}});
 try{const job=draft();await f.jobs.enqueue(job);await begun;await f.jobs.shutdown({timeoutMs:10});reject(Error('late network failure'));await f.jobs.drain();assert.equal((await f.jobs.read(job.id)).errorCode,'SHUTDOWN_TIMEOUT');}
 finally{reject(Error('cleanup'));await f.close();}
});

test('provider success followed by cue write failure remains uncertain across restart, explicit retry is required',async()=>{
 let failWrites=true,calls=0;
 const f=await fixture({generate:async cue=>{calls++;return {...cue,durationSec:1};},persist:async(file,value)=>{
  if(failWrites&&(value.cues.length>0||value.status==='failed'))throw Object.assign(Error('private disk path'),{code:'ENOSPC'});
  return atomicWriteJson(file,value);
 }});
 try{
  const job=draft();await f.jobs.enqueue(job);await f.jobs.drain();
  const failed=await f.jobs.get(job.id);assert.equal(failed.errorCode,'JOB_WRITE_FAILED');assert.equal(failed.retryable,false);assert.equal(failed.cues.length,0);assert.equal(calls,1);assert.ok(!failed.error.includes('private disk path'));
  const durable=await f.jobs.read(job.id);assert.equal(durable.resultPending,true);
  failWrites=false;
  const restarted=new AudioJobs({root:f.jobs.root,owner:{pid:process.pid,token:'restarted'},isOwnerAlive:async()=>false,timing:buildAudioTimeline,generate:async cue=>{calls++;return {...cue,durationSec:1};}});
  const interrupted=await restarted.get(job.id);assert.equal(interrupted.retryable,false);assert.equal(interrupted.status,'interrupted');assert.equal(calls,1);
  await restarted.get(job.id);assert.equal(calls,1);
  await restarted.enqueue(job);await restarted.drain();const complete=await restarted.get(job.id);assert.equal(complete.status,'complete');assert.equal(complete.resultPending,false);assert.equal(complete.cues.length,2);assert.equal(calls,3);assert.equal(complete.attempt,2);
 }finally{await f.close();}
});
test('legacy running jobs with an unrecorded current cue are recovered conservatively',async()=>{
 const f=await fixture({generate:()=>assert.fail('Recovery must not call provider')});
 try{
  const job={...draft(),status:'running',current:1};await atomicWriteJson(f.jobs.path(job.id),job);
  assert.equal((await f.jobs.get(job.id)).retryable,false);
  const queued={...draft(),status:'queued'};await atomicWriteJson(f.jobs.path(queued.id),queued);
  assert.equal((await f.jobs.get(queued.id)).retryable,true);
 }finally{await f.close();}
});
