import {test} from 'node:test';
import assert from 'node:assert/strict';
import {valueAt,setValue,validateDocument} from './model.mjs';
test('scrubbing respects endpoints, linear/smooth/hold and discrete flips',()=>{
 const motion={keys:{x:[{frame:10,value:0,easing:'linear'},{frame:30,value:100,easing:'linear'}],y:[{frame:10,value:0,easing:'hold'},{frame:30,value:80,easing:'linear'}],scale:[{frame:10,value:1,easing:'smooth'},{frame:30,value:2,easing:'linear'}],flipX:[{frame:10,value:false,easing:'linear'},{frame:30,value:true,easing:'linear'}]}};
 assert.equal(valueAt(motion,0).x,0);assert.equal(valueAt(motion,20).x,50);assert.equal(valueAt(motion,99).x,100);
 assert.equal(valueAt(motion,20).y,0);assert.equal(valueAt(motion,30).y,80);assert.equal(valueAt(motion,20).scale,1.5);assert.equal(valueAt(motion,20).flipX,false);assert.equal(valueAt(motion,30).flipX,true);
});
test('keyframed properties record at the playhead even with auto off; earlier keys stay intact',()=>{
 const original={keys:{x:[{frame:0,value:0,easing:'linear'},{frame:20,value:100,easing:'smooth'}]}};
 const shifted=setValue(original,10,{x:70},false);assert.equal(valueAt(shifted,0).x,0);assert.equal(valueAt(shifted,10).x,70);assert.equal(valueAt(shifted,20).x,100);
 const staticEdit=setValue({},10,{y:70},false);assert.equal(valueAt(staticEdit,0).y,70);assert.equal(staticEdit.keys.y,undefined);
 const auto=setValue(original,20,{x:80},true);assert.equal(auto.keys.x.length,2);assert.equal(auto.keys.x[1].value,80);assert.equal(auto.keys.x[1].easing,'smooth');assert.equal(original.keys.x[1].value,100);
});
test('reject invalid/duplicate/out-of-scene keyframes and unsafe transform values',()=>{
 const doc={version:1,revision:0,layers:{actor:{base:{scale:1,z:2},keys:{x:[{frame:0,value:0,easing:'linear'}]}}}};
 assert.equal(validateDocument(doc,60),doc);
 for(const layer of [{base:{scale:0}},{base:{z:1.5}},{base:{flipX:1}},{keys:{x:[{frame:60,value:0,easing:'linear'}]}},{keys:{x:[{frame:2,value:0,easing:'linear'},{frame:2,value:3,easing:'linear'}]}}])assert.throws(()=>validateDocument({...doc,layers:{actor:layer}},60));
});

test('position track groups legacy axes, moves both coordinates and rejects collisions',async()=>{
 const {trackKeys,editTrackKey}=await import('./model.mjs');
 const layer={keys:{x:[{frame:10,value:20,easing:'linear'},{frame:30,value:80,easing:'smooth'}],y:[{frame:10,value:40,easing:'linear'},{frame:30,value:90,easing:'linear'}]}};
 assert.deepEqual(trackKeys(layer,'position').map(k=>k.frame),[10,30]);
 const moved=editTrackKey(layer,'position',10,{frame:15});assert.equal(moved.keys.x[0].frame,15);assert.equal(moved.keys.y[0].frame,15);assert.equal(moved.keys.y[0].value,40);
 assert.throws(()=>editTrackKey(layer,'position',10,{frame:30}));
 const eased=editTrackKey(layer,'position',10,{easing:'hold'});assert.equal(eased.keys.x[0].easing,'hold');assert.equal(eased.keys.y[0].easing,'hold');
 const removed=editTrackKey(layer,'position',10,{remove:true});assert.equal(removed.keys.x.length,1);assert.equal(removed.keys.y.length,1);
 const added=setValue(layer,20,{x:99},false);assert.equal(added.keys.y.find(k=>k.frame===20).value,65);assert.equal(layer.keys.x.length,2);
 const legacy={keys:{x:layer.keys.x}};assert.equal(editTrackKey(legacy,'position',10,{frame:12}).keys.y[0].value,0);
});

test('added resources survive JSON roundtrip and reject unsafe paths or time ranges',()=>{
 const asset={name:'Prop',type:'props',from:10,to:30,left:100,top:200,width:50,height:80,parts:[{src:'library-assets/'+'a'.repeat(64)+'.png',left:0,top:0,width:50,height:80}]};
 const doc={version:1,revision:1,layers:{'S06/shot-0/user-test':{asset}}};
 assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc)),60),doc);
 for(const edit of [{from:30,to:20},{to:61},{parts:[{...asset.parts[0],src:'../secret.png'}]},{width:0}])assert.throws(()=>validateDocument({...doc,layers:{id:{asset:{...asset,...edit}}}},60));
});

test('acceleration curves roundtrip with exact endpoints',()=>{
 for(const [easing,expected] of [['ease-in',6.25],['ease-out',43.75]]){
  const layer={keys:{x:[{frame:0,value:0,easing},{frame:100,value:100,easing:'linear'}]}};
  assert.equal(valueAt(layer,25).x,expected);
  assert.equal(valueAt(layer,0).x,0);assert.equal(valueAt(layer,100).x,100);
  const doc={version:1,revision:0,layers:{actor:layer}};
  assert.deepEqual(validateDocument(JSON.parse(JSON.stringify(doc)),101),doc);
 }
});
test('key edits reject invalid input and sort scalar tracks without mutation',async()=>{
 const {editTrackKey,trackKeys}=await import('./model.mjs');
 const layer={keys:{x:[{frame:20,value:100,easing:'linear'},{frame:0,value:0,easing:'linear'}]}},before=structuredClone(layer);
 for(const action of [{frame:-1},{frame:1.5},{frame:NaN},{easing:'unknown'},{frame:20}])assert.throws(()=>editTrackKey(layer,'x',0,action));
 assert.throws(()=>editTrackKey(layer,'unknown',0,{frame:1}));
 assert.deepEqual(trackKeys(layer,'x').map(k=>k.frame),[0,20]);assert.deepEqual(layer,before);
});
