import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,resolvePlan,compilePlan,buildScene,DEFAULT_STAGE} from './scene-plan.mjs';
import {valueAt,validateDocument} from './model.mjs';
import {inspectBeats} from './beats.mjs';

const h=c=>c.repeat(64),part=(w,h2)=>({src:'library-assets/'+h('a')+'.png',left:0,top:0,width:w,height:h2});
const item=(id,name,extra={})=>({id:h(id),name,width:100,height:100,bbox:[0,0,100,100],...extra});
const catalog=[
  {id:'film/bg1',name:'Phòng vệ sinh',type:'backgrounds',collection:'film',canvas:[1920,1080],groups:{layers:[item('1','nền')]}},
  {id:'film/hero',name:'Nhật Thành',type:'characters',collection:'film',canvas:[900,1200],groups:{
    poses:[item('2','站立'),item('3','逃跑'),item('4','指责')],
    faces:[item('5','惊讶',{style:'bean'}),item('6','惊讶',{style:'detailed'}),item('7','生气',{style:'detailed'})]}},
  {id:'film/thug',name:'Canis',type:'characters',collection:'film',canvas:[900,1200],groups:{poses:[item('8','指责')],faces:[item('9','生气',{style:'detailed'})]}},
  {id:'film/fx',name:'Hiệu ứng va chạm',type:'effects',collection:'film',canvas:[1920,1080],groups:{props:[item('a','21')]}},
];
const prepare=async requests=>Object.fromEntries(Object.entries(requests).map(([key,r])=>{
  const owner=catalog.find(a=>a.id===r.catalogId);
  return [key,{name:owner.name,type:owner.type,width:owner.type==='backgrounds'||owner.type==='effects'?1920:400,height:owner.type==='backgrounds'||owner.type==='effects'?1080:1100,parts:[part(400,1100)]}];
}));
const plan=(over={})=>({version:1,id:'demo',title:'Demo',location:{asset:'Phòng vệ sinh'},cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'},canis:{asset:'Canis'}},
  transitions:{in:{type:'fade-black',frames:8},out:{type:'wipe-left',frames:10}},
  beats:[
    {id:'b1',quote:'Thấy gã đội trưởng Canis',frames:60,shot:'medium',actors:[{who:'hero',pose:'逃跑',face:'惊讶',at:'left',enter:'pop-in'},{who:'canis',pose:1,face:'生气',at:'right',depth:'mid'}],fx:[{effect:'Hiệu ứng va chạm',at:40,frames:10}],shake:true},
    {id:'b2',quote:'nhếch mép cười',frames:40,shot:'close',actors:[{who:'hero',pose:'指责',face:3,at:'center',exit:'fade-out'}]},
  ],...over});

test('a plan compiles into layers, keyframes, transitions and pending beats that pass document validation',async()=>{
  const scene=await buildScene(plan(),{catalog,prepareSelections:prepare}),d=scene.document;
  assert.equal(scene.source.duration,100);assert.deepEqual(scene.source.shots,[{from:0,to:60,label:'b1'},{from:60,to:100,label:'b2'}]);
  assert.doesNotThrow(()=>validateDocument(d,100));
  const ids=Object.keys(d.layers);assert.equal(ids.filter(i=>i.includes('/op-bg')).length,1);
  const hero=d.layers['demo/shot-0/op-b0-hero'],canis=d.layers['demo/shot-0/op-b0-canis'],close=d.layers['demo/shot-60/op-b1-hero'];
  assert.equal(hero.asset.from,0);assert.equal(hero.asset.to,60);assert.equal(close.asset.from,60);assert.equal(close.asset.to,100);
  assert.equal(valueAt(hero,0).opacity,0,'pop-in starts transparent');assert.equal(valueAt(hero,9).opacity,1);
  assert(Object.keys(canis.keys??{}).length>=2,'shake on every actor');assert.equal(valueAt(close,99).opacity,0.0,'exit fade-out ends transparent');
  assert(canis.base.x>hero.base.x,'right slot is right of left slot');
  assert(ids.some(i=>i.includes('op-b0-fx0')),'effect layer added');
  assert.deepEqual(d.transitions,{in:{type:'fade-black',frames:8},out:{type:'wipe-left',frames:10}});
  const beats=d.beats.items;assert.equal(beats.length,2);assert.equal(beats[0].review.status,'pending');assert.equal(beats[0].actor,'hero, canis');
  assert(beats[0].layerIds.every(i=>d.layers[i]),'beats link to real layers');assert(beats[0].action.includes('逃跑 + 惊讶'));
  assert.deepEqual(inspectBeats({duration:100,document:d}).errors.filter(e=>e.includes('layer')),[],'every beat is linked to layers');
});

test('shot size and depth control character height; later beats cut to a new layer',async()=>{
  const d=(await buildScene(plan(),{catalog,prepareSelections:prepare})).document,wide=d.layers['demo/shot-0/op-b0-hero'].base.scale,mid=d.layers['demo/shot-0/op-b0-canis'].base.scale,close=d.layers['demo/shot-60/op-b1-hero'].base.scale;
  assert(close>wide&&wide>mid,'close > medium(near) > medium(mid depth): '+[close,wide,mid]);
});

test('mixing face styles of one character is rejected: the agent must name a style and faces come only from it',()=>{
  assert.throws(()=>resolvePlan(plan({cast:{hero:{asset:'Nhật Thành'},canis:{asset:'Canis'}}}),catalog),/2 kiểu mặt/);
  const r=resolvePlan(plan(),catalog),use=r.uses.find(u=>u.who==='hero'&&u.beat===0);
  assert.equal(r.requests[use.key].itemIds[1],h('6'),'惊讶 resolves to the detailed one, not the bean one');
  assert.throws(()=>resolvePlan(plan({cast:{hero:{asset:'Canis',faceStyle:'bean'},canis:{asset:'Canis'}}}),catalog),/không có kiểu mặt bean/);
});

test('unknown names fail with the available choices instead of guessing',()=>{
  const bad=(over,re)=>assert.throws(()=>resolvePlan(plan(over),catalog),re);
  bad({beats:[{id:'b1',quote:'q',frames:30,actors:[{who:'hero',pose:'bay'}]}]},/Có: 1:站立 2:逃跑 3:指责/);
  bad({location:{asset:'Phòng ngủ'}},/không có trong catalog/);
  bad({beats:[{id:'b1',quote:'q',frames:30,actors:[{who:'hero',pose:1,face:'哭'}]}]},/mặt 哭/);
  bad({beats:[{id:'b1',quote:'q',frames:30,actors:[{who:'hero',pose:1,face:1}]}]},/thuộc kiểu bean/);
  bad({beats:[{id:'b1',quote:'q',frames:30,fx:[{effect:'Lửa'}]}]},/effect "Lửa"/);
});

test('plan validation rejects structural mistakes',()=>{
  const bad=(over,re)=>assert.throws(()=>validatePlan(plan(over)),re);
  bad({version:2},/version/);bad({beats:[]},/1–60 beat/);bad({extra:1},/trường lạ/);
  bad({beats:[{id:'b1',quote:'q',frames:3}]},/frames/);
  bad({beats:[{id:'b1',quote:'q',frames:30,camera:'orbit-360'}]},/camera phải thuộc/);
  bad({beats:[{id:'b1',quote:'q',frames:30,actors:[{who:'ghost',pose:1}]}]},/không có trong cast/);
  bad({beats:[{id:'b1',quote:'q',frames:30,actors:[{who:'hero',pose:1},{who:'hero',pose:2}]}]},/hai lần/);
  bad({beats:[{id:'b1',quote:'q',frames:30},{id:'b1',quote:'q',frames:30}]},/trùng/);
  bad({beats:[{id:'b1',quote:'q',frames:30,actors:[{who:'hero',pose:1,at:'nowhere'}]}]},/at không hợp lệ/);
});

test('stage data can be overridden per location (ground line and slots)',async()=>{
  const p=plan({transitions:undefined}),resolved=resolvePlan(p,catalog),selections=await prepare(resolved.requests);
  const base=compilePlan(p,resolved,selections).document.layers['demo/shot-0/op-b0-hero'],moved=compilePlan(p,resolved,selections,{stage:{groundY:900,slots:{left:400}}}).document.layers['demo/shot-0/op-b0-hero'];
  assert.notEqual(moved.base.y,base.base.y);assert.notEqual(moved.base.x,base.base.x);assert.equal(DEFAULT_STAGE.groundY,960);
});
