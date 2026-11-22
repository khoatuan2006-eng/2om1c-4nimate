import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProjectStore} from './project-store.mjs';
import {capturePreviewEvidence,verifyPreviewEvidence} from './preview-evidence.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=','base64');
test('server-issued capture binds bytes, project, scene, frame and effective inputs; draft review metadata does not stale it',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-capture-test-')),store=new ProjectStore(':memory:');
 const options={mediaDirectory:folder,workDirectory:join(folder,'work'),render:async({frames})=>frames.map(()=>png)};
 try{
  store.create('Fixture','p');store.addScene('p',{id:'S',title:'Draft',duration:90,cues:[],shots:[]},{version:1,revision:0,layers:{}});
  store.addScene('p',{id:'Later',title:'Later draft',duration:30,cues:[],shots:[]},{version:1,revision:0,layers:{}});
  const result=await capturePreviewEvidence(store,'p',{sceneId:'S',documentRevision:0,frames:[0,30,60]},options),e=result.evidence[0];
  assert.equal(await verifyPreviewEvidence(store,store.get('p'),e,options),true);
  assert.deepEqual(await readFile(e.path),png);
  const later=store.getEdits('Later','p');later.layers['Later/shot-0/object']={base:{x:18}};store.saveEdits('Later',later,'p');
  assert.equal(await verifyPreviewEvidence(store,store.get('p'),e,options),true,'Editing another scene must preserve this scene capture');
  await assert.rejects(verifyPreviewEvidence(store,store.get('p'),{...e,captureId:'00000000-0000-0000-0000-000000000000'},options),/Unknown/);
  await assert.rejects(verifyPreviewEvidence(store,store.get('p'),{...e,frame:1},options),/mismatch/);
  await assert.rejects(verifyPreviewEvidence(store,store.get('p'),{...e,path:'arbitrary.png'},options),/mismatch/);
  let doc=store.getEdits('S','p');doc.storyChains={version:1,chains:{}};doc=store.saveEdits('S',doc,'p');
  assert.equal(await verifyPreviewEvidence(store,store.get('p'),e,options),true);
  doc.layers['S/shot-0/object']={base:{x:25}};store.saveEdits('S',doc,'p');
  await assert.rejects(verifyPreviewEvidence(store,store.get('p'),e,options),/mismatch/);
  const next=await capturePreviewEvidence(store,'p',{sceneId:'S',documentRevision:2,frames:[0]},options);
  await writeFile(next.evidence[0].path,Buffer.concat([png,Buffer.from('changed')]));
  await assert.rejects(verifyPreviewEvidence(store,store.get('p'),next.evidence[0],options),/bytes changed/);
 }finally{store.close();}
});
test('capture rejects stale selection, invalid ranges and changes during rendering without issuing receipts',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-capture-test-')),store=new ProjectStore(':memory:');
 const options={mediaDirectory:folder,workDirectory:folder,render:async()=>{throw Error('Should not render');}};
 try{
  store.create('Fixture','p');store.addScene('p',{id:'S',title:'Draft',duration:90},{version:1,revision:0,layers:{}});
  await assert.rejects(capturePreviewEvidence(store,'p',{sceneId:'S',documentRevision:5,frames:[0]},options),/revision/);
  await assert.rejects(capturePreviewEvidence(store,'p',{sceneId:'S',documentRevision:0,frames:[90]},options),/frames/);
  await assert.rejects(capturePreviewEvidence(store,'p',{sceneId:'S',documentRevision:0,frames:[0]}, {...options,render:async()=>{const doc=store.getEdits('S','p');doc.layers['S/shot-0/object']={base:{x:5}};store.saveEdits('S',doc,'p');return [png];}}),/changed during/);
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM meta WHERE key LIKE 'preview-capture:%'").get().n,0);
 }finally{store.close();}
});
