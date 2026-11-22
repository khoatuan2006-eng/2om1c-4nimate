import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {testRuntime} from './test-runtime.mjs';
import {CreateRequestScope,applySceneRequest} from './create-request-scope.mjs';
import {requestSceneResource} from './create-scene-api.mjs';
import {assertAudioDraft} from './audio-draft.mjs';
const deferred=()=>{let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve};};
test('real HTTP audio completion and missing-job errors delivered late do not replace the new draft',async()=>{
 const f=await testRuntime({audioGenerator:async cue=>({...cue,durationSec:1.1,publicPath:'/generated/audio/fixture.mp3'})});
 try{
  const project=f.store.create('Delayed audio reply'),voice=(await fetch(f.base+'/api/created-scenes/voices').then(r=>r.json())).defaultVoiceId;
  const draft={id:randomUUID(),voiceId:voice,text:'Original line'},input={...draft,projectId:project.id};
  assert.equal((await f.request('/api/created-scenes/audio',input)).status,202);
  let job;for(let i=0;i<100;i++){job=await fetch(f.base+'/api/created-scenes/audio?id='+draft.id).then(r=>r.json());if(job.status==='complete')break;await new Promise(ok=>setTimeout(ok,10));}
  assert.equal(job.status,'complete');assertAudioDraft(job,draft,project.id);
  const scope=new CreateRequestScope();scope.selectDraft(project.id,draft);let updates=0,errors=0,settles=0;
  const fetched=deferred(),release=deferred();
  const pending=applySceneRequest(scope,async()=>{
   const reply=await requestSceneResource(f.base+'/api/created-scenes/audio?id='+draft.id);fetched.resolve();await release.promise;return reply;
  },{onValue:value=>{assertAudioDraft(value,draft,project.id);updates++;},onError:()=>errors++,onSettled:()=>settles++});
  await fetched.promise;scope.selectDraft(project.id,{...draft,id:randomUUID(),text:'New draft'});release.resolve();assert.equal((await pending).current,false);assert.equal(updates+errors+settles,0);
  const errorRead=deferred(),errorRelease=deferred();scope.selectDraft(project.id,draft);
  const failed=applySceneRequest(scope,async()=>{
   let failure;try{await requestSceneResource(f.base+'/api/created-scenes/audio?id='+randomUUID());}catch(error){failure=error;}
   assert.equal(failure.status,404);errorRead.resolve();await errorRelease.promise;throw failure;
  },{onValue:()=>updates++,onError:()=>errors++,onSettled:()=>settles++});
  await errorRead.promise;scope.invalidate();errorRelease.resolve();assert.equal((await failed).current,false);assert.equal(updates+errors+settles,0);
  assert.equal(f.store.get(project.id).scenes.length,0);
 }finally{await f.close();}
});
