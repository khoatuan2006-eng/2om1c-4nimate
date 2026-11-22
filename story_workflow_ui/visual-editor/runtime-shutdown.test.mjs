import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {testRuntime} from './test-runtime.mjs';

test('runtime shutdown persists an interrupted audio job before releasing its data lease',async()=>{
 let release,started;const gate=new Promise(ok=>release=ok),begun=new Promise(ok=>started=ok);
 const f=await testRuntime({shutdownTimeoutMs:20,audioGenerator:async cue=>{started();await gate;return {...cue,durationSec:1};}});
 try{
  const project=await f.request('/api/projects',{title:'Shutdown fixture'}).then(r=>r.json());
  const voice=(await fetch(f.base+'/api/created-scenes/voices').then(r=>r.json())).defaultVoiceId,id=randomUUID();
  assert.equal((await f.request('/api/created-scenes/audio',{id,projectId:project.id,text:'First\nSecond',voiceId:voice})).status,202);await begun;
  await access(join(f.folder,'data','runtime.lock'));
  const closing=f.app.close();assert.equal(closing,f.app.close());await closing;
  const path=join(f.folder,'data','jobs',id+'.audio.json'),result=JSON.parse(await readFile(path,'utf8'));
  assert.equal(result.status,'interrupted');assert.equal(result.errorCode,'SHUTDOWN_TIMEOUT');assert.equal(result.cues.length,0);
  await assert.rejects(()=>access(join(f.folder,'data','runtime.lock')),error=>error.code==='ENOENT');
  release();const {getAudioJobs}=await import('./created-scenes-server.mjs');await getAudioJobs().drain();
  assert.deepEqual(JSON.parse(await readFile(path,'utf8')),result);
 }finally{release();await f.close();}
});
