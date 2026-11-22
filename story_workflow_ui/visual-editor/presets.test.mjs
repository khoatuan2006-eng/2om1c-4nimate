import test from 'node:test';
import assert from 'node:assert/strict';
import {applyAuthoringOperations,authoringOperations} from './authoring-operations.mjs';
import {valueAt,validateDocument} from './model.mjs';
import {transitionOverlay,validateTransitions} from './transitions.mjs';

const source={id:'S',duration:120};
const part=(w,h)=>({src:'library-assets/'+'a'.repeat(64)+'.png',left:0,top:0,width:w,height:h});
const doc=()=>({version:1,revision:0,layers:{'S/shot-0/hero':{base:{z:100,x:0,y:0},asset:{name:'hero',type:'characters',from:0,to:120,left:0,top:0,width:200,height:400,parts:[part(200,400)]}}}});
const hero='S/shot-0/hero';
const run=(commands,selections,d=doc())=>applyAuthoringOperations(source,d,commands,selections);
const effect={name:'Nhát chém',type:'effects',width:1920,height:1080,parts:[part(1920,1080)]};

test('presets are listed so agents can discover them',()=>{
  for(const op of ['fade','pop-in','shake','transition','effect'])assert(authoringOperations.operations.includes(op),op);
  assert.deepEqual(authoringOperations.transitions,['fade-black','fade-white','wipe-left','wipe-right','flash']);
});

test('fade compiles to opacity keyframes and refuses to overwrite existing ones silently',()=>{
  const {document:d}=run([{op:'fade',layerId:hero,from:60,to:90,opacity:[1,0]}]);
  const layer=d.layers[hero];
  assert.equal(valueAt(layer,59).opacity,1);assert.equal(valueAt(layer,89).opacity,0);assert.equal(valueAt(layer,119).opacity,0);
  assert.ok(Math.abs(valueAt(layer,74.5).opacity-.5)<.05,'smooth easing passes through the middle');
  assert.throws(()=>run([{op:'fade',layerId:hero,from:70,to:100,opacity:[1,0]}],{},d),/replaceKeys/);
  assert.doesNotThrow(()=>run([{op:'fade',layerId:hero,from:70,to:100,opacity:[1,0],replaceKeys:true}],{},d));
  assert.throws(()=>run([{op:'fade',layerId:hero,from:60,to:90,opacity:[1,2]}]),/opacity/);
  assert.throws(()=>run([{op:'fade',layerId:hero,from:60,to:130,opacity:[1,0]}]),/khoảng xuất hiện/);
});

test('pop-in fades and scales up from the current scale',()=>{
  const d0=doc();d0.layers[hero].base.scale=2;
  const {document:d}=run([{op:'pop-in',layerId:hero,from:10,frames:8}],{},d0),layer=d.layers[hero];
  assert.equal(valueAt(layer,10).opacity,0);assert.equal(valueAt(layer,10).scale,1.7);
  assert.equal(valueAt(layer,17).opacity,1);assert.equal(valueAt(layer,17).scale,2);assert.equal(valueAt(layer,100).scale,2);
});

test('shake oscillates around the current position and returns to it',()=>{
  const d0=doc();d0.layers[hero].base={z:100,x:50,y:20};
  const {document:d,warnings}=run([{op:'shake',layerId:hero,from:30,to:50,amplitude:10,step:2}],{},d0),layer=d.layers[hero];
  assert.equal(valueAt(layer,30).x,50);assert.equal(valueAt(layer,49).x,50);assert.equal(valueAt(layer,49).y,20);
  const xs=Array.from({length:20},(_,i)=>valueAt(layer,30+i).x);assert(Math.max(...xs)>50&&Math.min(...xs)<50);
  assert(Math.max(...xs.map(x=>Math.abs(x-50)))<=10,'never exceeds amplitude');assert(warnings.length>0);
  assert.throws(()=>run([{op:'shake',layerId:hero,from:30,to:50,amplitude:0}]),/amplitude/);
});

test('transition is stored on the document, validated, and removable',()=>{
  const {document:d}=run([{op:'transition',side:'in',type:'fade-black',frames:12},{op:'transition',side:'out',type:'wipe-left',frames:8}]);
  assert.deepEqual(d.transitions,{in:{type:'fade-black',frames:12},out:{type:'wipe-left',frames:8}});
  const {document:d2}=run([{op:'transition',side:'in',remove:true},{op:'transition',side:'out',remove:true}],{},d);assert.equal(d2.transitions,undefined);
  assert.throws(()=>run([{op:'transition',side:'in',type:'spin',frames:5}]),/không hợp lệ/);
  assert.throws(()=>run([{op:'transition',side:'middle',type:'flash',frames:5}]),/side/);
  assert.throws(()=>run([{op:'transition',side:'in',type:'flash',frames:500}]),/không hợp lệ/);
});

test('transition overlay covers fully at the scene edges and never outside its frames',()=>{
  const t={in:{type:'fade-black',frames:6},out:{type:'wipe-right',frames:6}};
  assert.equal(transitionOverlay(t,0,60).opacity,1);assert.equal(transitionOverlay(t,6,60),null);assert.equal(transitionOverlay(t,53,60),null);
  assert.equal(transitionOverlay(t,59,60).clipPath,'inset(0 0% 0 0)');
  const out=Array.from({length:6},(_,i)=>transitionOverlay(t,54+i,60).clipPath);assert.notEqual(out[0],out[5]);
  assert.equal(transitionOverlay({in:{type:'flash',frames:4}},0,60).color,'#ffffff');assert.equal(transitionOverlay(undefined,0,60),null);
  assert.throws(()=>validateTransitions({in:{type:'fade-black',frames:100}},200),/không hợp lệ/);
});

test('effect adds an effects-type layer with an opacity envelope; only effects assets are accepted',()=>{
  const {document:d}=run([{op:'effect',id:'slash',asset:'fx',from:20,to:40,inFrames:2,outFrames:6}],{fx:effect}),id='S/shot-20/op-slash',layer=d.layers[id];
  assert.equal(layer.asset.type,'effects');assert.equal(layer.base.z,300);
  assert.equal(valueAt(layer,20).opacity,0);assert.equal(valueAt(layer,22).opacity,1);assert.equal(valueAt(layer,32).opacity,1);assert.equal(valueAt(layer,39).opacity,0);
  assert.equal(layer.asset.from,20);assert.equal(layer.asset.to,40);
  assert.throws(()=>run([{op:'effect',id:'x',asset:'fx',from:20,to:40}],{fx:{...effect,type:'props'}}),/effects/);
  assert.throws(()=>run([{op:'effect',id:'x',asset:'fx',from:20,to:24,inFrames:3,outFrames:3}],{fx:effect}),/inFrames/);
  assert.throws(()=>run([{op:'add-character',id:'x',asset:'fx',from:0,to:30}],{fx:effect}),/nhân vật/);
});

test('opacity is a validated numeric field',()=>{
  const d=doc();d.layers[hero].base.opacity=.4;assert.doesNotThrow(()=>validateDocument(d,120));
  d.layers[hero].base.opacity=1.5;assert.throws(()=>validateDocument(d,120),/opacity/);
  const k=doc();k.layers[hero].keys={opacity:[{frame:5,value:-.1,easing:'linear'}]};assert.throws(()=>validateDocument(k,120),/Keyframe/);
});
