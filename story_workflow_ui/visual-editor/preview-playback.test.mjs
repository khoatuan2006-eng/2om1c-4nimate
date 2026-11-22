import test from 'node:test';
import assert from 'node:assert/strict';
import {ProjectStore} from './project-store.mjs';
import {startPreviewPlayback,recordPreviewPlayback,verifyPreviewPlayback} from './preview-playback.mjs';
import {attachPlaybackReporter} from './playback-reporter.mjs';
test('elapsed server records reject seeks, stale inputs and invented coverage; metadata-only save preserves actual range',()=>{
 const store=new ProjectStore(':memory:');let clock=1000;const options={now:()=>clock};
 try{
  store.create('Fixture','p');store.addScene('p',{id:'S',title:'Draft',duration:90,cues:[]},{version:1,revision:0,layers:{}});
  store.addScene('p',{id:'Later',title:'Later draft',duration:30,cues:[]},{version:1,revision:0,layers:{}});
  const jumped=startPreviewPlayback(store,'p',{sceneId:'S',documentRevision:0,frame:0},options);
  assert.throws(()=>recordPreviewPlayback(store,'p',{playbackId:jumped.playbackId,frame:89},options),/seek, gap or speed/);
  assert.throws(()=>recordPreviewPlayback(store,'p',{playbackId:jumped.playbackId,frame:1},options),/closed/);
  const first=startPreviewPlayback(store,'p',{sceneId:'S',documentRevision:0,frame:0},options);
  clock+=1000;recordPreviewPlayback(store,'p',{playbackId:first.playbackId,frame:30},options);clock+=1000;recordPreviewPlayback(store,'p',{playbackId:first.playbackId,frame:60},options);clock+=1000;recordPreviewPlayback(store,'p',{playbackId:first.playbackId,frame:89,ended:true},options);
  const playback={ranges:[{playbackId:first.playbackId,sceneId:'S',from:0,to:90}]};assert.equal(verifyPreviewPlayback(store,store.get('p'),playback),true);
  const later=store.getEdits('Later','p');later.layers['Later/shot-0/object']={base:{x:20}};store.saveEdits('Later',later,'p');
  assert.equal(verifyPreviewPlayback(store,store.get('p'),playback),true,'Another scene edit must not invalidate this played range');
  assert.throws(()=>verifyPreviewPlayback(store,store.get('p'),{ranges:[{...playback.ranges[0],to:91}]}),/not covered/);
  assert.throws(()=>verifyPreviewPlayback(store,store.get('p'),{ranges:[{sceneId:'S',from:0,to:90}]}),/Missing/);
  let doc=store.getEdits('S','p');doc.storyChains={version:1,chains:{}};doc=store.saveEdits('S',doc,'p');assert.equal(verifyPreviewPlayback(store,store.get('p'),playback),true);
  doc.layers['S/shot-0/object']={base:{x:4}};store.saveEdits('S',doc,'p');assert.throws(()=>verifyPreviewPlayback(store,store.get('p'),playback),/not covered/);
 }finally{store.close();}
});
test('player event adapter sends start/frame/end in order and disconnects',async()=>{
 const handlers=new Map(),requests=[];let frame=0,stamp=0;
 const player={getCurrentFrame:()=>frame,isPlaying:()=>true,addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name)};
 const stop=attachPlaybackReporter(player,{sceneId:'S',documentRevision:3,now:()=>stamp,post:async body=>{requests.push(body);return {playbackId:'receipt'};},onError:assert.fail});
 stamp=1000;frame=30;handlers.get('frameupdate')();stamp=2000;frame=59;handlers.get('ended')();
 await new Promise(ok=>setImmediate(ok));stop();
 assert.deepEqual(requests,[{sceneId:'S',documentRevision:3,frame:0},{playbackId:'receipt',frame:30,ended:false},{playbackId:'receipt',frame:59,ended:true}]);assert.equal(handlers.size,0);
});
