import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBeats,inspectBeats,draftBeatsFromScene} from './beats.mjs';
import {validateDocument} from './model.mjs';
import {ProjectStore} from './project-store.mjs';
import {inspectProjectProduction} from './production-workflow.mjs';

const png='library-assets/'+'a'.repeat(64)+'.png';
const layer=(from,to)=>({base:{z:1},asset:{name:'hero',type:'characters',from,to,left:0,top:0,width:100,height:200,parts:[{src:png,left:0,top:0,width:100,height:200}]}});
const doc=(beats)=>({version:1,revision:0,layers:{'S/shot-0/hero':layer(0,60),'S/shot-0/bg':layer(0,90)},...(beats?{beats}:{})});
const beat=(over={})=>({id:'b1',quote:'Thấy Canis đuổi tới',actor:'Nhật Thành',action:'quay lại nhìn đám đuổi',from:0,to:60,layerIds:['S/shot-0/hero'],...over});

test('validateBeats accepts a well-formed beat and rejects bad references, ranges and fields',()=>{
  const d=doc({version:1,items:[beat()]});assert.doesNotThrow(()=>validateDocument(d,90));
  const bad=over=>()=>validateDocument(doc({version:1,items:[beat(over)]}),90);
  assert.throws(bad({layerIds:['missing']}),/layer có thật/);
  assert.throws(bad({to:120}),/khoảng frame/);
  assert.throws(bad({actor:' '}),/actor/);
  assert.throws(bad({extra:1}),/trường lạ/);
  assert.throws(bad({review:{status:'issue'}}),/cần ghi chú/);
  assert.throws(()=>validateBeats({version:1,items:[beat(),beat()]},90,doc().layers),/trùng/);
  assert.doesNotThrow(()=>validateDocument(doc(),90),'beats are optional');
});

test('inspectBeats blocks unreviewed/unlinked/issue beats and warns on uncovered frames',()=>{
  const scene=items=>({document:{beats:{version:1,items}}});
  assert.deepEqual(inspectBeats({document:{}}).errors,['chưa có beat']);
  const r=inspectBeats(scene([beat({from:10,layerIds:[]}),beat({id:'b2',from:70,to:80,review:{status:'issue',note:'sai hướng'}})]));
  assert(r.errors.includes('beat b1 chưa gắn layer'));assert(r.errors.includes('beat b1 chưa review'));assert(r.errors.some(e=>e.includes('sai hướng')));
  assert(r.warnings.some(w=>w.includes('0–10')));assert(r.warnings.some(w=>w.includes('60–70')));
  assert.deepEqual(inspectBeats(scene([beat({review:{status:'ok'}})])).errors,[]);
});

test('draftBeatsFromScene makes one pending beat per cue linked to overlapping layers',()=>{
  const scene={duration:90,cues:[{text:'Câu một',from:0,to:40},{text:'Câu hai',from:40,to:90}],document:doc()};
  const drafted=draftBeatsFromScene(scene);
  assert.equal(drafted.items.length,2);assert.deepEqual(drafted.items[1].layerIds,['S/shot-0/hero','S/shot-0/bg']);
  assert.equal(drafted.items[0].review.status,'pending');assert.doesNotThrow(()=>validateBeats(drafted,90,scene.document.layers));
});

test('draft mode lets scenes be added without review; production mode and publishing stay strict',async()=>{
  const store=new ProjectStore(':memory:',{productionMode:true});
  const p=store.create('Test');const source=id=>({id,title:id,duration:90});
  const d=id=>({version:1,revision:0,layers:{[id+'/shot-0/hero']:layer(0,60)}});
  store.addScene(p.id,source('A'),d('A'));
  assert.throws(()=>store.addScene(p.id,source('B'),d('B')),/Production review required/);
  assert.equal(store.setMode(p.id,'draft'),'draft');assert.equal(store.mode(p.id),'draft');
  store.addScene(p.id,source('B'),d('B'));assert.equal(store.get(p.id).scenes.length,2);
  const draft=await inspectProjectProduction(store.get(p.id),{mode:'draft'});
  assert.equal(draft.canExpand,true);assert.equal(draft.canPublish,false);assert(draft.errors.length>0);
  assert.throws(()=>store.requireProductionReceipt(store.get(p.id),'complete'),/Production review required/,'export still needs a complete receipt');
  assert.throws(()=>store.setMode(p.id,'yolo'),/không hợp lệ/);
  store.setMode(p.id,'production');assert.throws(()=>store.addScene(p.id,source('C'),d('C')),/Production review required/);
  store.close();
});

test('beat scenes replace the task contract in the gate',async()=>{
  const project={id:'p',revision:1,scenes:[{id:'S',duration:90,document:doc({version:1,items:[beat({review:{status:'ok'}})]})}]};
  const gate=await inspectProjectProduction(project);
  assert.deepEqual(gate.errors,[]);assert.equal(gate.canPublish,true);assert.deepEqual(gate.beats.S,{beats:1,reviewed:1});
  assert.equal(gate.warnings.length,1,'frames 60–90 uncovered is a warning, not a block');
});
