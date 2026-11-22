import test from 'node:test';
import assert from 'node:assert/strict';
import {matchCatalogItem,resolveActorFlip,poseFacing,loadSemanticRegistry,locationStageFor,fxMetaFor} from './semantic-catalog.mjs';
import {buildScene,resolvePlan} from './scene-plan.mjs';

const h=c=>c.repeat(64),part=(w,h2)=>({src:'library-assets/'+h('a')+'.png',left:0,top:0,width:w,height:h2});
const item=(id,name,extra={})=>({id:h(id),name,width:100,height:100,bbox:[0,0,100,100],...extra});
const catalog=[
  {id:'film/bg-hem',name:'Tường thấp bên trái · hẻm · Chưa duyệt',type:'backgrounds',collection:'film',canvas:[1920,1080],groups:{layers:[item('1','nền')]}},
  {id:'film/hero',name:'Nhật Thành',type:'characters',collection:'film',canvas:[900,1200],groups:{
    poses:[item('2','站立'),item('3','叉腰'),item('4','逃跑')],
    faces:[item('5','惊吓',{style:'detailed'}),item('6','坏笑',{style:'detailed'})]}},
  {id:'film/canis',name:'Canis',type:'characters',collection:'film',canvas:[900,1200],groups:{
    poses:[item('7','右手出拳'),item('8','右手向前')],
    faces:[item('9','生气',{style:'detailed'})]}},
  {id:'film/fx',name:'Hiệu ứng va chạm',type:'effects',collection:'film',canvas:[1920,1080],groups:{props:[item('a','21')]}},
];
const prepare=async requests=>Object.fromEntries(Object.entries(requests).map(([key,r])=>{
  const owner=catalog.find(a=>a.id===r.catalogId);
  return [key,{name:owner.name,type:owner.type,width:owner.type==='backgrounds'||owner.type==='effects'?1920:400,height:owner.type==='backgrounds'||owner.type==='effects'?1080:1100,parts:[part(400,1100)]}];
}));

test('Vietnamese and English aliases resolve to Chinese pose/face names without guessing',()=>{
  const poses=catalog[1].groups.poses;
  assert.equal(matchCatalogItem(poses,'chống nạnh').item.name,'叉腰');
  assert.equal(matchCatalogItem(poses,'chong nanh').item.name,'叉腰');
  assert.equal(matchCatalogItem(poses,'flee').item.name,'逃跑');
  const canisPoses=catalog[2].groups.poses;
  assert.equal(matchCatalogItem(canisPoses,'đấm').item.name,'右手出拳');
  assert.equal(matchCatalogItem(canisPoses,'punch').item.name,'右手出拳');
  const faces=catalog[2].groups.faces;
  assert.equal(matchCatalogItem(faces,'tức giận').item.name,'生气');
  assert.equal(matchCatalogItem(faces,'angry').item.name,'生气');
});

test('poseFacing and resolveActorFlip compute flip automatically from look and faceTo',()=>{
  const reg=loadSemanticRegistry();
  assert.equal(poseFacing('右手出拳',reg),'right');
  assert.equal(poseFacing('左手向前',reg),'left');
  assert.equal(poseFacing('叉腰',reg),'front');
  const positions=new Map([['hero',600],['canis',1360]]);
  // Canis on the right with right-facing punch facing hero on the left -> must flip
  assert.equal(resolveActorFlip({actor:{who:'canis',faceTo:'hero'},poseName:'右手出拳',x:1360,beatPositions:positions,registry:reg}),true);
  // Explicit flip:false overrides faceTo
  assert.equal(resolveActorFlip({actor:{who:'canis',faceTo:'hero',flip:false},poseName:'右手出拳',x:1360,beatPositions:positions,registry:reg}),false);
  // Look right with right-facing pose -> no flip
  assert.equal(resolveActorFlip({actor:{who:'canis',look:'right'},poseName:'右手出拳',x:1360,beatPositions:positions,registry:reg}),false);
  // 3/4 poses tagged 'front' (e.g. '站立', '双手抱胸') still flip left when facing a left target or look:'left'
  assert.equal(resolveActorFlip({actor:{who:'naruto',faceTo:'hero'},poseName:'站立',x:1360,beatPositions:positions,assetName:'鸣人中期',registry:reg}),true);
  assert.equal(resolveActorFlip({actor:{who:'naruto',look:'left'},poseName:'双手抱胸',x:1360,beatPositions:positions,assetName:'鸣人中期',registry:reg}),true);
  assert.equal(resolveActorFlip({actor:{who:'hero',look:'right'},poseName:'站立',x:600,beatPositions:positions,assetName:'鸣人中期',registry:reg}),false);
});

test('scene-plan compiles Vietnamese aliases, faceTo auto-flip, per-location stage and warns on full-screen FX',async()=>{
  const plan={
    version:1,id:'vi-demo',title:'Demo tiếng Việt',
    location:{asset:'Tường thấp bên trái · hẻm · Chưa duyệt'},
    cast:{hero:{asset:'Nhật Thành',faceStyle:'detailed'},canis:{asset:'Canis',faceStyle:'detailed'}},
    beats:[{
      id:'b1',quote:'Canis đấm về phía Nhật Thành',frames:60,shot:'medium',
      shake:{at:6,frames:10,intensity:12},
      actors:[
        {who:'hero',pose:'chống nạnh',face:'hoảng sợ',at:'far-left'},
        {who:'canis',pose:'đấm',face:'tức giận',at:'right',faceTo:'hero'},
      ],
      fx:[{effect:'Hiệu ứng va chạm',at:10,frames:8}],
    }],
  };
  const scene=await buildScene(plan,{catalog,prepareSelections:prepare});
  const heroLayer=scene.document.layers['vi-demo/shot-0/op-b0-hero'];
  const canisLayer=scene.document.layers['vi-demo/shot-0/op-b0-canis'];
  assert.equal(canisLayer.base.flipX,true,'canis auto-flips toward hero on the left');
  assert.equal(heroLayer.base.flipX,false,'front-facing pose stays unflipped');
  // Location stage shifts far-left from default 320 to 460 (away from left alley wall)
  const expectedStage=locationStageFor('Tường thấp bên trái · hẻm · Chưa duyệt');
  assert.equal(expectedStage.slots['far-left'],460);
  assert.equal(Math.round(heroLayer.asset.left+heroLayer.asset.width/2+heroLayer.base.x),460);
  // Full-screen FX warning is emitted
  assert(scene.warnings.some(w=>w.includes('full-screen')),'warns about full-screen FX covering actors');
  assert.equal(fxMetaFor('Hiệu ứng va chạm').scope,'full-screen');
});
