import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';
import {applyAuthoringOperations} from './authoring-operations.mjs';import {prepareCatalogSelections} from './catalog-selection.mjs';import {valueAt} from './model.mjs';
import {ProjectStore} from './project-store.mjs';import {authoringOperationsPlugin} from './authoring-operations-server.mjs';
const source={id:'S-test',title:'Test',duration:120,kind:'created',shots:[{from:0,to:120}],cues:[]},id='S-test/shot-0/hero';
const image=(char='a')=>({name:'hero',type:'characters',width:100,height:200,parts:[{src:'library-assets/'+char.repeat(64)+'.png',left:0,top:0,width:100,height:200}]}),selections={hero:image(),other:image('b')};
const document=()=>({version:1,revision:0,layers:{[id]:{base:{z:100},asset:{...image(),from:0,to:120,left:0,top:0}}}});
test('place/layout use visual bottom anchor and move uses existing interpolation',()=>{
 const result=applyAuthoringOperations(source,document(),[{op:'place',layerId:id,placement:{x:600,y:900,height:400}},{op:'move',layerId:id,from:10,to:30,delta:{x:240,y:-50},easing:'linear'}]);
 const layer=result.document.layers[id],a=layer.asset,v=valueAt(layer,10);assert.equal(a.left+a.width/2+v.x,600);assert.equal(a.top+a.height/2+v.y+a.height/2*v.scale,900);assert.equal(valueAt(layer,29).x-v.x,240);assert.equal(valueAt(layer,29).y-v.y,-50);
 assert.throws(()=>applyAuthoringOperations(source,result.document,[{op:'move',layerId:id,from:10,to:30,delta:{x:1}}]),/keyframe/);
 const next=applyAuthoringOperations(source,document(),[{op:'layout',preset:'solo',layerIds:[id]}]);assert.equal(valueAt(next.document.layers[id],0).scale,3.3);
});
test('catalog replacement/pose changes preserve original motion, timing and other layers',()=>{
 const doc=document();doc.layers[id].keys={x:[{frame:0,value:0,easing:'linear'},{frame:119,value:100,easing:'hold'}]};const result=applyAuthoringOperations(source,doc,[{op:'set-pose-face',layerId:id,asset:'other'}],selections);
 assert.deepEqual(result.document.layers[id].keys,doc.layers[id].keys);assert.equal(result.document.layers[id].asset.to,120);assert.equal(result.document.layers[id].asset.parts[0].src,selections.other.parts[0].src);assert.deepEqual(doc.layers[id].asset.parts,image().parts);
});
test('anchor is exact for supported sprites and rejects rotated contact claims',()=>{
 const result=applyAuthoringOperations(source,document(),[{op:'anchor',layerId:id,local:{x:25,y:125},target:{x:800,y:600}}]),v=valueAt(result.document.layers[id],0);assert.equal(25+v.x,800);assert.equal(125+v.y,600);const doc=document();doc.layers[id].base.rotation=10;assert.throws(()=>applyAuthoringOperations(source,doc,[{op:'anchor',layerId:id,local:{x:0,y:0},target:{x:1,y:1}}]),/xoay/);
});
test('pose sequence requires distinct existing contiguous state layers',()=>{
 const doc=document(),second='S-test/shot-30/state';doc.layers[id].asset.to=30;doc.layers[second]=structuredClone(doc.layers[id]);doc.layers[second].asset.from=30;doc.layers[second].asset.to=60;
 const states=[{layerId:id,from:0,to:30,asset:'hero'},{layerId:second,from:30,to:60,asset:'other'}],result=applyAuthoringOperations(source,doc,[{op:'pose-sequence',states}],selections);assert.equal(result.changes.length,2);states[1].from=31;assert.throws(()=>applyAuthoringOperations(source,doc,[{op:'pose-sequence',states}],selections),/liên tục/);
});
test('invalid later operation cannot partially mutate the original batch input',()=>{
 const doc=document(),before=JSON.stringify(doc);assert.throws(()=>applyAuthoringOperations(source,doc,[{op:'place',layerId:id,placement:{x:400,y:900}},{op:'unsupported'}]),/không hỗ trợ/);assert.equal(JSON.stringify(doc),before);
});
test('new actors can bind to source tasks without mutating immutable source',()=>{
 const src={...source,scriptPlan:{tasks:[{id:'T1',from:10,to:30,layerIds:[id]}]}},doc=document();doc.production={version:1,taskBindings:{T1:{}}};const result=applyAuthoringOperations(src,doc,[{op:'add-character',id:'new',asset:'hero',from:0,to:60,taskIds:['T1']}],selections);assert.equal(result.document.production.taskBindings.T1.layerIds.length,2);assert.deepEqual(src.scriptPlan.tasks[0].layerIds,[id]);
});
test('catalog selection composes same-owner pose/face via bbox and rejects foreign ids',async()=>{
 const owner={id:'hero',name:'Hero',type:'characters',canvas:[500,500],groups:{poses:[{id:'pose',name:'Pose',bbox:[100,50,300,450],width:200,height:400}],faces:[{id:'face',name:'Face',bbox:[140,70,180,100],width:40,height:30}]}},options={catalogReader:async()=>[owner],prepare:async id=>({src:'library-assets/'+(id==='pose'?'a':'b').repeat(64)+'.png'})};
 const result=await prepareCatalogSelections({actor:{catalogId:'hero',itemIds:['pose','face']}},options);assert.equal(result.actor.parts[1].left,40);assert.equal(result.actor.parts[1].top,20);assert.equal(result.actor.height,400);await assert.rejects(prepareCatalogSelections({actor:{catalogId:'hero',itemIds:['pose','foreign']}},options),/không thuộc/);await assert.rejects(prepareCatalogSelections({actor:{catalogId:'hero',itemIds:['face']}},options),/pose đầu tiên/);
});
test('batch API is dry-run safe, atomic, version guarded, replay safe and lock/project isolated',async()=>{
 const store=new ProjectStore(':memory:');store.create('One','p1');store.create('Two','p2');store.addScene('p1',source,document());let handler;authoringOperationsPlugin({store,prepare:async()=>selections}).configureServer({middlewares:{use:fn=>handler=fn}});const server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
 const body={id:'batch-1',revision:0,commands:[{op:'place',layerId:id,placement:{x:500,y:900,height:400}}]},send=(body,project='p1',origin=base)=>fetch(base+'/api/authoring/projects/'+project+'/scenes/'+source.id+'/batch',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await send(body,'p1','http://remote.invalid')).status,403);assert.equal((await send(body,'p2')).status,404);
  assert.equal((await send({...body,dryRun:true})).status,200);assert.equal(store.getEdits(source.id,'p1').revision,0);
  assert.equal((await send({...body,commands:[...body.commands,{op:'bad'}]})).status,400);assert.equal(store.getEdits(source.id,'p1').revision,0);
  assert.equal((await send(body)).status,200);assert.equal(store.getEdits(source.id,'p1').revision,1);assert.equal(store.history(source.id,'p1').length,1);
  const replay=await (await send({...body,commands:body.commands.map(c=>Object.fromEntries(Object.entries(c).reverse()))})).json();assert.equal(replay.reused,true);assert.equal(store.getEdits(source.id,'p1').revision,1);
  assert.equal((await send({...body,commands:[]})).status,409);assert.equal((await send({...body,id:'new'})).status,409);
  store.db.prepare('UPDATE projects SET locked_prefix=? WHERE id=?').run(JSON.stringify([source.id]),'p1');assert.equal((await send({...body,id:'locked',revision:1})).status,409);assert.equal(store.get('p2').revision,0);
 }finally{await new Promise(ok=>server.close(ok));store.close();}
});
