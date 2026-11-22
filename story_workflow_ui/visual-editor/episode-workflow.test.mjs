import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {testRuntime} from './test-runtime.mjs';
import {newEpisodeRow,splitEpisodeScript,emptyEpisodeWorkflow,validateEpisodeWorkflow,episodeSceneId} from './episode-workflow.mjs';
test('script splitting preserves source, validates limits and never invents events',()=>{
 const script='A tới.\nB chờ.\n\nA rời đi.',rows=splitEpisodeScript(script,randomUUID);
 assert.deepEqual(rows.map(r=>r.text),['A tới.\nB chờ.','A rời đi.']);assert.equal(splitEpisodeScript(script,randomUUID,'line').length,3);
 const draft={...emptyEpisodeWorkflow(),rows};assert.deepEqual(validateEpisodeWorkflow(draft),draft);
 assert.throws(()=>validateEpisodeWorkflow({...draft,rows:[rows[0],rows[0]]}));assert.throws(()=>validateEpisodeWorkflow({...draft,rows:[{...rows[0],seconds:0}]}));
 assert.throws(()=>splitEpisodeScript(Array(101).fill('A').join('\n\n'),randomUUID));
});
test('saved workflow builds real project scenes, resumes, preserves edits, reviews and safely rebuilds',{timeout:30000},async()=>{
 const f=await testRuntime({audioGenerator:async cue=>({...cue,durationSec:1,publicPath:'generated/audio/fixture.wav'})});
 try{
  const root=join(f.folder,'library','backgrounds','room');await mkdir(root,{recursive:true});
  await sharp({create:{width:1920,height:1080,channels:4,background:'#334455'}}).png().toFile(join(root,'room.png'));
  await writeFile(join(root,'asset.manifest.json'),JSON.stringify({displayName:'Room',capabilities:{layers:[{name:'Room',relativePath:'backgrounds/room/room.png',bbox:[0,0,1920,1080]}]}}));await writeFile(join(root,'manifest.json'),JSON.stringify({canvas:[1920,1080]}));
  const p=f.store.create('New episode'),other=f.store.create('Untouched'),url='/api/episode-workflows/'+p.id;
  const get=async()=>fetch(f.base+url).then(r=>r.json());
  const cat=await fetch(f.base+'/api/library/catalog').then(r=>r.json()),backgroundId=cat.find(a=>a.name==='Room').groups.layers[0].id;
  const rows=[newEpisodeRow(randomUUID(),'A bước vào.'),newEpisodeRow(randomUUID(),'B đáp lại.')].map((r,i)=>({...r,title:'Scene '+i,backgroundId,seconds:3,camera:'push-in'}));
  let workflow={...emptyEpisodeWorkflow(),rows};
  assert.equal((await f.request(url,workflow,'PUT','http://evil.example')).status,403);
  let response=await f.request(url,workflow,'PUT');assert.equal(response.status,200);workflow=(await response.json()).workflow;
  assert.equal((await f.request(url,{...workflow,revision:0},'PUT')).status,409);
  assert.equal((await get()).workflow.rows.length,2);
  const build=async row=>f.request(url+'/rows/'+row.id+'/build',{revision:workflow.revision,projectRevision:f.store.get(p.id).revision});
  response=await build(rows[1]);assert.equal(response.status,201,await response.clone().text());
  // Production runtime refuses further construction until current work is reviewed.
  response=await build(rows[0]);assert.equal(response.status,409);assert.match((await response.json()).error,/Production review required/);
  const exportAttempt=await f.request('/api/exports',{projectId:p.id,scale:.5,requestId:randomUUID()});assert.equal(exportAttempt.status,409);
  assert.equal((await fetch(f.base+'/api/exports?project='+p.id).then(r=>r.json())).length,0);
  // Remaining assertions exercise builder editing mechanics in this isolated test fixture.
  // Production singleton has no HTTP operation to turn this protection off.
  f.store.productionMode=false;
  response=await build(rows[0]);assert.equal(response.status,201,await response.clone().text());
  let project=f.store.get(p.id);assert.deepEqual(project.sceneOrder,rows.map(episodeSceneId));assert.equal(project.duration,180);assert.equal(project.scenes[0].subtitleCues[0].text,rows[0].text);assert.equal(project.scenes[0].cues.length,0);
  const scene=project.scenes[0],layer=Object.keys(scene.document.layers)[0];assert.equal(scene.document.layers[layer].camera.enabled,true);assert(scene.document.layers[layer].asset.width>1920,'Camera background needs an overscan margin');
  let doc=structuredClone(scene.document);doc.layers[layer].base.x=17;doc=f.store.saveEdits(scene.id,doc,p.id);
  response=await build(rows[0]);assert.equal((await response.json()).reused,true);assert.equal(f.store.getEdits(scene.id,p.id).layers[layer].base.x,17);
  assert.equal((await f.request(url,{...workflow,rows:[{...rows[0],text:'Changed'},rows[1]]},'PUT')).status,409);
  response=await f.request(url,{...workflow,rows:[rows[1],rows[0]]},'PUT');assert.equal(response.status,200);workflow=(await response.json()).workflow;project=f.store.get(p.id);assert.deepEqual(project.sceneOrder,[episodeSceneId(rows[1]),episodeSceneId(rows[0])]);
  const reviewURL=url+'/rows/'+rows[0].id+'/review';
  assert.equal((await f.request(reviewURL,{projectRevision:project.revision,documentRevision:0,checks:[true,true,true]})).status,409);
  assert.equal((await f.request(reviewURL,{projectRevision:project.revision,documentRevision:doc.revision,checks:[true,true,false]})).status,400);
  assert.equal((await f.request(reviewURL,{projectRevision:project.revision,documentRevision:doc.revision,checks:[true,true,true]})).status,200);
  assert.equal((await get()).reviews[rows[0].id].documentRevision,1);
  response=await f.request(url+'/rows/'+rows[0].id+'/reset',{revision:workflow.revision,projectRevision:project.revision,documentRevision:0});assert.equal(response.status,409);
  response=await f.request(url+'/rows/'+rows[0].id+'/reset',{revision:workflow.revision,projectRevision:project.revision,documentRevision:doc.revision});assert.equal(response.status,200);const reset=await response.json();assert.notEqual(reset.rowId,rows[0].id);assert.equal(reset.project.scenes.length,1);assert.equal(f.store.db.prepare("SELECT COUNT(*) n FROM meta WHERE key LIKE 'removed-scene:%'").get().n,1);
  assert.equal(f.store.get(other.id).revision,0);assert.equal(f.store.get(other.id).scenes.length,0);
  // Existing audio job infrastructure supplies measured timing; wrong audio never enters the scene.
  workflow={...reset.workflow,audioMode:'voice',voiceId:'voice.capcut.mai.v1'};response=await f.request(url,workflow,'PUT');assert.equal(response.status,200);workflow=(await response.json()).workflow;
  const row=workflow.rows.find(r=>r.id===reset.rowId);
  assert.notEqual((await build(row)).status,201);
  response=await f.request('/api/created-scenes/audio',{id:row.id,projectId:p.id,text:row.text,voiceId:workflow.voiceId});assert.equal(response.status,202);
  const {getAudioJobs}=await import('./created-scenes-server.mjs');await getAudioJobs().drain();
  response=await build(row);assert.equal(response.status,201,await response.clone().text());const audioScene=f.store.get(p.id).scenes.find(s=>s.id===episodeSceneId(row));assert.equal(audioScene.duration,30);assert.equal(audioScene.cues.length,1);
 }finally{await f.close();}
});
