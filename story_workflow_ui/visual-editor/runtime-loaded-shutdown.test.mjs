import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {testRuntime} from './test-runtime.mjs';
import {fixtureProductionReceipt} from './test-fixtures/production-receipt.mjs';

test('HTTP runtime stops concurrent audio and a stubborn export before releasing storage; reopening does not restart jobs',{timeout:30000},async()=>{
 let release,secondStarted,reopened;
 const gate=new Promise(ok=>release=ok),begun=new Promise(ok=>secondStarted=ok),calls=[];
 const f=await testRuntime({shutdownTimeoutMs:40,audioGenerator:async cue=>{
  calls.push(cue.text);
  if(cue.text==='second'){secondStarted();await gate;}
  return {...cue,durationSec:1,publicPath:'/generated/audio/fixture.mp3'};
 }});
 const {getExportJobs}=await import('./export-server.mjs');
 const {getAudioJobs}=await import('./created-scenes-server.mjs');
 const exports=getExportJobs(),audio=getAudioJobs();
 // Real worker processes and cancellation; this fixture deliberately produces
 // no video and makes no external provider request.
 exports.workerPath=resolve(import.meta.dirname,'test-fixtures/export-process.mjs');
 try{
  const project=await f.request('/api/projects',{title:'ignore-cancel'}).then(r=>r.json());
  f.store.addScene(project.id,{id:'shutdown-scene',title:'Shutdown fixture',kind:'created',duration:30,shots:[{from:0,to:30}],cues:[]},{version:1,revision:0,layers:{}});
  const expected=f.store.get(project.id);
  const productionReceipt=fixtureProductionReceipt(f.store,project.id);
  const voice=(await fetch(f.base+'/api/created-scenes/voices').then(r=>r.json())).defaultVoiceId,id=randomUUID();
  assert.equal((await f.request('/api/created-scenes/audio',{id,projectId:project.id,text:'first\nsecond',voiceId:voice})).status,202);
  await begun;
  const requestId=randomUUID();f.app.authorizeExport({projectId:project.id,revision:expected.revision,fingerprint:productionReceipt.fingerprint,requestId,scale:1});
  const response=await f.request('/api/exports',{projectId:project.id,scale:1,requestId});
  assert.equal(response.status,202);const job=await response.json();
  let running;
  for(let n=0;n<150;n++){running=await exports.get(job.id);if(running.status==='rendering'&&running.grandchildPid)break;await delay(20);}
  assert.equal(running.status,'rendering');assert.ok(running.grandchildPid);
  const worker=exports.workers.get(job.id);assert.ok(worker);
  await access(join(f.folder,'data.lease','owner.json'));
  const closing=f.app.close();assert.equal(closing,f.app.close());await closing;
  assert.equal(exports.workers.size,0);
  assert(worker.child.exitCode!==null||worker.child.signalCode!==null);
  // A killed descendant can briefly be observable while Windows finishes exit.
  for(let n=0;n<100;n++){try{process.kill(running.grandchildPid,0);}catch(error){if(error.code==='ESRCH')break;throw error;}await delay(20);}
  assert.throws(()=>process.kill(running.grandchildPid,0),{code:'ESRCH'});
  const saved=JSON.parse(await readFile(join(f.folder,'data','jobs',id+'.audio.json'),'utf8'));
  assert.equal(saved.status,'interrupted');assert.equal(saved.errorCode,'SHUTDOWN_TIMEOUT');assert.equal(saved.cues.length,1);assert.equal(saved.cues[0].text,'first');
  assert.equal((await exports.get(job.id)).status,'cancelled');
  await assert.rejects(access(join(f.folder,'data','runtime.lock')),{code:'ENOENT'});
  await assert.rejects(access(join(f.folder,'data.lease')),{code:'ENOENT'});
  await assert.rejects(fetch(f.base+'/api/health',{signal:AbortSignal.timeout(1000)}));
  release();await audio.drain();
  assert.deepEqual(JSON.parse(await readFile(join(f.folder,'data','jobs',id+'.audio.json'),'utf8')),saved);
  const {createEditorRuntime}=await import('./runtime-server.mjs');
  reopened=await createEditorRuntime({frontendRoot:f.frontendRoot,log:()=>{},audioGenerator:async()=>{throw Error('Reopen must not call the provider');}});
  const address=await reopened.listen(0),base='http://127.0.0.1:'+address.port;
  assert.deepEqual(await fetch(base+'/api/projects/'+project.id).then(r=>r.json()),expected);
  assert.equal((await fetch(base+'/api/created-scenes/audio?id='+id).then(r=>r.json())).status,'interrupted');
  assert.equal((await fetch(base+'/api/exports/'+job.id).then(r=>r.json())).status,'cancelled');
  assert.equal(getExportJobs().workers.size,0);assert.deepEqual(calls,['first','second']);
 }finally{release();await reopened?.close();await f.close();}
});
