import test from 'node:test';
import assert from 'node:assert/strict';
import {attachPreviewControl} from './preview-control-client.mjs';
import {attachPlaybackReporter} from './playback-reporter.mjs';
const flush=()=>new Promise(ok=>setImmediate(ok));
function fixture(){
 const handlers=new Map(),calls=[];let frame=0,playing=false,scheduled,context;
 const emit=name=>{for(const handler of [...handlers.get(name)??[]])handler();};
 const player={getCurrentFrame:()=>frame,isPlaying:()=>playing,seekTo:n=>{frame=n;},play:()=>{playing=true;emit('play');},pause:()=>{playing=false;emit('pause');},addEventListener:(name,fn)=>{if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},removeEventListener:(name,fn)=>handlers.get(name)?.delete(fn)};
 const command={requestId:'request',sceneId:'S',documentRevision:0,from:0,to:60,status:'queued'};
 context={player,sceneId:'S',documentRevision:0,mode:'scene',canPreview:true,savedDocumentMatches:true,selectScene:()=>{},reload:()=>{}};
 const request=async(path,body)=>{calls.push({path,body});if(!body)return {requests:command.status==='queued'?[command]:[]};if(body.action==='claim')command.status='claimed';if(body.action==='finish')command.status='played-unreviewed';if(body.action==='fail')command.status='failed';return {...command};};
 const options={projectId:'p',clientId:'client',getContext:()=>context,request,onError:()=>{},setTimer:fn=>{scheduled=fn;return 1;},clearTimer:()=>{scheduled=null;}};
 return {options,player,command,calls,context,advance(n){frame=n;emit('frameupdate');},async tick(){const run=scheduled;scheduled=null;run?.();await flush();},get playing(){return playing;}};
}
test('controller claims saved range, uses existing Player/reporter, pauses at boundary and reports played-unreviewed',async()=>{
 const f=fixture(),control=attachPreviewControl(f.options);
 const stopReporter=attachPlaybackReporter(f.player,{sceneId:'S',documentRevision:0,post:async body=>{const record={playbackId:'server-playback',sceneId:'S',closed:body.ended===true};await control.onRecord(record);return record;},onError:assert.fail});
 try{
  await f.tick();assert.equal(f.playing,true);assert.deepEqual(f.calls.filter(c=>c.body).map(c=>c.body.action),['claim','bind']);
  f.advance(59);await flush();assert.equal(f.playing,false);assert.equal(f.command.status,'played-unreviewed');assert.equal(f.calls.at(-1).body.action,'finish');
 }finally{control.stop();stopReporter();}
});
test('dirty draft and busy manual playback are never navigated or played by a queued request',async()=>{
 const f=fixture(),control=attachPreviewControl(f.options);try{f.context.canPreview=false;await f.tick();assert.equal(f.calls.length,0);f.context.canPreview=true;f.player.play();await f.tick();assert.equal(f.calls.length,0);}finally{control.stop();}
});
test('an edit during asynchronous claim prevents playback; a changed active context fails instead of completing',async()=>{
 const f=fixture(),request=f.options.request;let release;f.options.request=(path,body)=>body?.action==='claim'?new Promise(ok=>{release=()=>request(path,body).then(ok);}):request(path,body);
 const control=attachPreviewControl(f.options);try{await f.tick();f.context.documentRevision=1;release();await flush();assert.equal(f.playing,false);assert.equal(f.command.status,'failed');assert(!f.calls.some(c=>c.body?.action==='finish'));}finally{control.stop();}
 const g=fixture(),active=attachPreviewControl(g.options);try{await g.tick();g.context.canPreview=false;await g.tick();assert.equal(g.command.status,'failed');assert.equal(g.playing,false);}finally{active.stop();}
});
