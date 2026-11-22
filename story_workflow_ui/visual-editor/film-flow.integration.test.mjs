import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {testRuntime} from './test-runtime.mjs';
import {assertAudioDraft} from './audio-draft.mjs';
import {requestSceneResource} from './create-scene-api.mjs';
let f,voice,background;const calls=[];let failSecond=true;
before(async()=>{
 f=await testRuntime({audioGenerator:async cue=>{calls.push(cue.text);if(cue.text==='second'&&failSecond){failSecond=false;throw Error('Injected provider interruption');}return {...cue,durationSec:cue.text==='first'?1.001:2.2,publicPath:'/generated/audio/tts-fixture.mp3'};}});
 const root=join(f.folder,'library','backgrounds','room');await mkdir(root,{recursive:true});
 await writeFile(join(root,'room.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvXcAAAAASUVORK5CYII=','base64'));
 await writeFile(join(root,'asset.manifest.json'),JSON.stringify({displayName:'Fixture room',capabilities:{layers:[{id:'room',name:'Room',relativePath:'backgrounds/room/room.png',bbox:[0,0,1,1]}]}}));await writeFile(join(root,'manifest.json'),JSON.stringify({canvas:[1,1]}));
 voice=(await fetch(f.base+'/api/created-scenes/voices').then(r=>r.json())).defaultVoiceId;
 background=(await fetch(f.base+'/api/library/catalog').then(r=>r.json())).find(asset=>asset.type==='backgrounds').groups.layers[0].id;
});
after(async()=>{await f?.close();});
async function terminal(id){for(let attempt=0;attempt<200;attempt++){const job=await fetch(f.base+'/api/created-scenes/audio?id='+id).then(r=>r.json());if(['complete','failed','interrupted','cancelled'].includes(job.status))return job;await delay(10);}throw Error('Audio fixture did not settle');}
test('HTTP workflow: create project, resume interrupted provider, commit a background scene once, save XY keyframes, reopen and restore',async()=>{
 const project=await f.request('/api/projects',{title:'Film flow fixture'}).then(r=>r.json()),id=randomUUID(),input={id,projectId:project.id,text:'first\nsecond',voiceId:voice};
 const posted=await Promise.all([f.request('/api/created-scenes/audio',input),f.request('/api/created-scenes/audio',input)]);assert.ok(posted.every(r=>r.status===202));
 let audio=await terminal(id);assert.equal(audio.status,'failed');assertAudioDraft(audio,{...input},project.id);assert.equal(audio.cues.length,1);assert.deepEqual(calls,['first','second']);
 await f.request('/api/created-scenes/audio',input);audio=await terminal(id);assert.equal(audio.status,'complete');assertAudioDraft(audio,{...input},project.id);assert.equal(audio.duration,97);assert.deepEqual(calls,['first','second','second']);assert.equal(audio.ownerToken,undefined);
 const create={id,projectId:project.id,title:'Measured scene',backgroundId:background};
 await assert.rejects(requestSceneResource('/api/created-scenes',create,async()=>{
  const response=await f.request('/api/created-scenes',create);assert.equal(response.status,201);await response.json();
  return new Response('<html>Receipt lost</html>',{status:200});
 }),error=>error.code==='INVALID_RESPONSE');
 const scenes=await Promise.all([f.request('/api/created-scenes',create),f.request('/api/created-scenes',create)]);assert.deepEqual(scenes.map(r=>r.status).sort(),[200,200]);
 let result=await fetch(f.base+'/api/projects/'+project.id).then(r=>r.json());assert.equal(result.scenes.length,1);assert.equal(result.duration,97);
 const scene=result.scenes[0],path=`/api/edits?project=${project.id}&scene=${scene.id}`,doc=structuredClone(scene.document),layer=doc.layers[Object.keys(doc.layers)[0]];
 layer.keys={x:[{frame:0,value:0,easing:'linear'},{frame:60,value:100,easing:'linear'}],y:[{frame:0,value:0,easing:'linear'},{frame:60,value:30,easing:'linear'}]};
 assert.equal((await f.request(path,doc,'PUT')).status,200);const reopened=await fetch(f.base+path).then(r=>r.json());assert.equal(reopened.revision,1);assert.equal(Object.values(reopened.layers)[0].keys.x[1].value,100);
 const history=await fetch(f.base+`/api/projects/${project.id}/scenes/${scene.id}/history`).then(r=>r.json());assert.equal(history[0].revision,0);
 const staleRestore=await f.request(`/api/projects/${project.id}/scenes/${scene.id}/restore`,{revision:0,restoreRevision:0});assert.equal(staleRestore.status,409);
 assert.deepEqual(await fetch(f.base+path).then(r=>r.json()),reopened);
 assert.equal((await f.request(`/api/projects/${project.id}/scenes/${scene.id}/restore`,{revision:1,restoreRevision:0})).status,200);
 result=await fetch(f.base+'/api/projects/'+project.id).then(r=>r.json());assert.equal(result.duration,97);assert.deepEqual(result.scenes[0].cues,scene.cues);assert.equal(result.scenes[0].document.revision,2);
});
