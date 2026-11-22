import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ProjectStore} from './project-store.mjs';
import {requestPreviewPlayback,queuedPreviewRequests,readPreviewRequest,updatePreviewRequest} from './preview-control.mjs';
import {startPreviewPlayback,recordPreviewPlayback} from './preview-playback.mjs';
test('bounded Studio preview requires current scene, exclusive claim, actual range and stopped server playback; never reviews it',()=>{
 const store=new ProjectStore(':memory:');let clock=1000;const options={now:()=>clock},clientId=randomUUID();
 try{
  store.create('Preview fixture','p');store.create('Foreign','other');store.addScene('p',{id:'S',title:'Draft',kind:'created',duration:90,cues:[]},{version:1,revision:0,layers:{}});
  const input={sceneId:'S',documentRevision:0,from:0,to:60};
  assert.throws(()=>requestPreviewPlayback(store,'p',{...input,to:301},options),/range/);assert.throws(()=>requestPreviewPlayback(store,'p',{...input,documentRevision:1},options),/revision/);
  const request=requestPreviewPlayback(store,'p',input,options),update=changes=>updatePreviewRequest(store,'p',request.requestId,{clientId,...changes},options);
  assert.throws(()=>requestPreviewPlayback(store,'p',input,options),/already/);assert.equal(queuedPreviewRequests(store,'p',options).length,1);
  assert.throws(()=>readPreviewRequest(store,'other',request.requestId,options),/another project/);
  assert.throws(()=>update({action:'claim',documentRevision:1}),/revision/);update({action:'claim',documentRevision:0});
  assert.throws(()=>updatePreviewRequest(store,'p',request.requestId,{action:'claim',clientId:randomUUID(),documentRevision:0},options),/not waiting/);
  const playback=startPreviewPlayback(store,'p',{sceneId:'S',documentRevision:0,frame:0},options);update({action:'bind',playbackId:playback.playbackId});
  assert.throws(()=>update({action:'finish',playbackId:playback.playbackId}),/not covered/);
  clock+=1000;recordPreviewPlayback(store,'p',{playbackId:playback.playbackId,frame:30},options);clock+=1000;recordPreviewPlayback(store,'p',{playbackId:playback.playbackId,frame:59},options);
  assert.throws(()=>update({action:'finish',playbackId:playback.playbackId}),/not stopped/);
  recordPreviewPlayback(store,'p',{playbackId:playback.playbackId,frame:59,ended:true},options);
  const done=update({action:'finish',playbackId:playback.playbackId});assert.equal(done.status,'played-unreviewed');assert.deepEqual(done.range,{playbackId:playback.playbackId,sceneId:'S',from:0,to:60});assert.equal(store.getEdits('S','p').storyChains,undefined);
  assert.equal(update({action:'finish',playbackId:playback.playbackId}).status,'played-unreviewed');
 }finally{store.close();}
});
test('queued commands expire and saved edits invalidate claims without changing scene data',()=>{
 const store=new ProjectStore(':memory:');let clock=0;const options={now:()=>clock};
 try{
  store.create('Preview fixture','p');store.addScene('p',{id:'S',title:'Draft',kind:'created',duration:90,cues:[]},{version:1,revision:0,layers:{}});
  const request=requestPreviewPlayback(store,'p',{sceneId:'S',documentRevision:0,from:0,to:90},options);clock=60000;assert.equal(readPreviewRequest(store,'p',request.requestId,options).status,'expired');
  const next=requestPreviewPlayback(store,'p',{sceneId:'S',documentRevision:0,from:0,to:90},options);const doc=store.getEdits('S','p');doc.layers['S/shot-0/object']={base:{x:5}};store.saveEdits('S',doc,'p');
  assert.equal(readPreviewRequest(store,'p',next.requestId,options).status,'failed');assert.equal(queuedPreviewRequests(store,'p',options).length,0);
  assert.throws(()=>updatePreviewRequest(store,'p',next.requestId,{action:'claim',documentRevision:0,clientId:randomUUID()},options),/not waiting/);assert.equal(store.getEdits('S','p').revision,1);
 }finally{store.close();}
});
