import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertAudioDraft} from './audio-draft.mjs';
test('corrupt audio progress never enables background selection or crashes cue rendering',()=>{
 const draft={id:'a',text:'first',voiceId:'mai'},cue={cueId:'a-0',text:'first',durationSec:1.001,publicPath:'/generated/audio/a.mp3',from:0,to:31};
 const valid={id:'a',projectId:'p',voiceId:'mai',lines:['first'],status:'complete',cues:[cue],duration:31};assert.equal(assertAudioDraft(valid,draft,'p'),valid);
 for(const changed of [{cues:null},{status:'unknown'},{cues:[]},{duration:30},{cues:[{...cue,durationSec:NaN}]},{cues:[{...cue,to:30}]},{cues:[{...cue,text:'other'}]},{cues:[{...cue,cueId:'foreign'}]},{cues:[{...cue,publicPath:'//elsewhere/audio.mp3'}]}])assert.throws(()=>assertAudioDraft({...valid,...changed},draft,'p'),error=>error.code==='INVALID_AUDIO_JOB');
 assert.throws(()=>assertAudioDraft(null,draft,'p'),error=>error.code==='INVALID_AUDIO_JOB');
 const partial={...valid,status:'failed',cues:[{...cue,from:undefined,to:undefined}],duration:undefined};assert.equal(assertAudioDraft(partial,draft,'p'),partial);
});
test('resume audio only when identity, project, voice and normalized dialogue still match the submitted draft',()=>{
 const draft={id:'a',text:' first \n\nsecond ',voiceId:'mai'},job={id:'a',projectId:'p',voiceId:'mai',lines:['first','second'],cues:[],status:'queued'};
 assert.equal(assertAudioDraft(job,draft,'p'),job);
 for(const changed of [{id:'b'},{projectId:'other'},{voiceId:'different'},{lines:['other','second']}])assert.throws(()=>assertAudioDraft({...job,...changed},draft,'p'),error=>error.status===409);
 assert.equal(assertAudioDraft({...job,projectId:undefined},draft,'nhat-thanh-ep01').status,'queued');
});
