import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateCueAudio} from '../backend/services/tts.service.mjs';
import {dispatchTtsGeneration} from '../backend/services/tts-providers.service.mjs';
import {removeTestFolder} from './test-runtime.mjs';
const cue={cueId:'abort-fixture',sceneId:'fixture',text:'Dòng kiểm thử dừng audio.',voiceId:'voice.capcut.mai.v1'};
test('shutdown abort reaches the selected provider and no partial audio is published',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-')),controller=new AbortController();let started,providerAborted=false;
 const begun=new Promise(ok=>started=ok);
 try{
  const result=generateCueAudio(cue,{signal:controller.signal,outputRoot:folder,remotionOutputRoot:folder,dispatch:async({outputFile,signal})=>{
   await writeFile(outputFile,'partial');started();await new Promise((_,fail)=>signal.addEventListener('abort',()=>{providerAborted=true;fail(Error('Provider aborted'));},{once:true}));
  },probe:()=>{throw Error('Incomplete audio must not be probed');}});
  const rejected=assert.rejects(()=>result,error=>error.code==='TTS_ABORTED');await begun;controller.abort();await rejected;
  assert.equal(providerAborted,true);assert.deepEqual(await readdir(join(folder,'generated','audio')),[]);
 }finally{await removeTestFolder(folder);}
});
test('an already stopped request never dispatches; cancellation preserves explicit provider choice',async()=>{
 const controller=new AbortController();controller.abort();let calls=0;
 await assert.rejects(()=>generateCueAudio(cue,{signal:controller.signal,dispatch:()=>{calls++;}}),error=>error.name==='AbortError');assert.equal(calls,0);
 const signal=new AbortController().signal;
 await dispatchTtsGeneration({...cue,outputFile:'unused',signal},{capcut:async(_text,_speaker,_resource,_file,settings)=>{assert.equal(settings.signal,signal);calls++;},edge:()=>assert.fail('fallback'),google:()=>assert.fail('fallback')});assert.equal(calls,1);
});
