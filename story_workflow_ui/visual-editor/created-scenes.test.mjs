import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAudioTimeline} from './created-scenes-server.mjs';
test('measured speech determines contiguous subtitle ranges without clipping fractional frames',()=>{
  const {cues,duration}=buildAudioTimeline([{text:'Một',durationSec:1.001},{text:'Hai',durationSec:2.2}]);
  assert.deepEqual(cues.map(c=>[c.from,c.to]),[[0,31],[31,97]]);
  assert.equal(duration,97);
  for(const c of cues)assert.ok((c.to-c.from)/30>=c.durationSec);
});
test('unmeasured or invalid audio cannot establish a scene timeline',()=>{
  for(const durationSec of [undefined,0,-1,Infinity,NaN])assert.throws(()=>buildAudioTimeline([{durationSec}]));
  assert.throws(()=>buildAudioTimeline([]));
});
