import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ProjectStore} from './project-store.mjs';
import {chainFingerprint,storyHash} from './story-chain.mjs';
import {performanceRecipes} from './production-contract.mjs';
import {inspectProjectProduction,transitionProduction,productionFingerprint} from './production-workflow.mjs';
import {productionWorkflowPlugin} from './production-workflow-server.mjs';
import {productionInputsDigest} from './production-inputs.mjs';

function fixture(){
 const project={id:'p',revision:1,scenes:[{id:'S',from:0,duration:90,cues:[],shots:[],scriptPlan:{tasks:[{id:'T',from:0,to:90,layerIds:['L']}]},document:{version:1,revision:0,layers:{L:{asset:{type:'backgrounds',from:0,to:90}}},production:{version:1,taskBindings:{T:{recipeId:'establish-space',recipeVersion:1,acceptedLimits:performanceRecipes.recipes[0].limitations}}}}}]};
 const chain={version:1,id:'route',steps:[{id:'look',before:'No route visible',actor:'Hero',action:'Observe',target:'Alley',response:'Attention changes',result:'Route recognized',visibleChange:'Route now visible',dependsOn:[],taskRefs:[{sceneId:'S',taskId:'T'}],resources:[{sceneId:'S',layerId:'L',use:'Shows route'}]}]};
 chain.review={fingerprint:chainFingerprint(chain,project),outcome:'pass',steps:[{id:'look',outcome:'pass',observedChange:'Route now visible'}],issues:[],playback:{watched:true,ranges:[{sceneId:'S',from:0,to:90}],observed:'Route revealed'},evidence:['before','action','result'].map((phase,i)=>({stepId:'look',phase,sceneId:'S',frame:30*i,path:phase,sha256:storyHash(phase),observation:'Saw '+phase}))};
 project.scenes[0].document.storyChains={version:1,chains:{route:chain}};
 return {project,chain};
}
// Structural unit fixtures only. HTTP tests install the real server verifiers.
const options={readEvidence:async p=>p,verifyEvidence:async()=>true,verifyPlayback:async()=>true};
test('runtime route rejects checksum-valid caller evidence without a server capture receipt',async()=>{
 const {project}=fixture(),store=new ProjectStore(':memory:');store.create('Fixture','p');
 const scene=project.scenes[0],{document,...source}=scene;
 store.db.prepare('INSERT INTO scenes VALUES(?,?,?,?,?)').run(scene.id,'p',JSON.stringify(source),JSON.stringify(document),0);
 store.db.prepare('UPDATE projects SET scene_order=?,revision=1 WHERE id=?').run('["S"]','p');
 let handler;productionWorkflowPlugin({store,readEvidence:async p=>p}).configureServer({middlewares:{use:fn=>{handler=fn;}}});
 const server=createServer((req,res)=>handler(req,res,()=>res.end()));await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await inspectProjectProduction(store.get('p'),options)).canExpand,true,'Structural fixture passes byte-only checks');
  const response=await fetch(base+'/api/production-workflows/p');const state=await response.json();assert.equal(state.canExpand,false);assert(state.errors.some(e=>e.includes('Studio')));
  const transition=await fetch(base+'/api/production-workflows/p',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({revision:1,action:'complete'})});assert.equal(transition.status,409);
 }finally{await new Promise(ok=>server.close(ok));store.close();}
});
test('production store blocks every addScene caller without current expansion receipt; edits remain possible',()=>{
 const store=new ProjectStore(':memory:',{productionMode:true});
 try{
  store.create('Fixture','p');const doc={version:1,revision:0,layers:{}};
  store.addScene('p',{id:'S',title:'Initial draft',duration:90},doc);
  assert.throws(()=>store.addScene('p',{id:'S2',title:'Bypass',duration:90},doc),{code:'PRODUCTION_GATE_REQUIRED'});
  // Fixture represents a receipt issued by the transition service, never supplied by addScene caller.
  const receipt={action:'expand',fingerprint:productionFingerprint(store.get('p')),inputsDigest:productionInputsDigest(store.get('p'),store.mediaDirectory)};
  store.db.prepare('INSERT INTO meta VALUES(?,?)').run('production-transition:p',JSON.stringify(receipt));
  store.saveEdits('S',doc,'p');
  assert.throws(()=>store.addScene('p',{id:'S2',title:'Stale receipt',duration:90},doc),{code:'PRODUCTION_GATE_REQUIRED'});
  receipt.fingerprint=productionFingerprint(store.get('p'));
  store.db.prepare('UPDATE meta SET value=? WHERE key=?').run(JSON.stringify(receipt),'production-transition:p');
  store.addScene('p',{id:'S2',title:'Permitted',duration:90},doc);
  assert.equal(store.get('p').scenes.length,2);
  assert.throws(()=>store.addScene('p',{id:'S3',title:'Receipt reuse',duration:90},doc),{code:'PRODUCTION_GATE_REQUIRED'});
  assert.throws(()=>store.requireProductionReceipt(store.get('p'),'complete'),{code:'PRODUCTION_GATE_REQUIRED'});
 }finally{store.close();}
});
test('evaluates real coverage and review, rejects omitted task and missing issue list',async()=>{
 const {project,chain}=fixture();assert.equal((await inspectProjectProduction(project,options)).canExpand,true);
 delete chain.review.issues;assert.equal((await inspectProjectProduction(project,options)).canExpand,false);chain.review.issues=[];
 project.scenes[0].scriptPlan.tasks.push({id:'omitted',from:0,to:90,layerIds:['L']});
 const result=await inspectProjectProduction(project,options);assert.equal(result.canExpand,false);assert.ok(result.errors.some(x=>x.includes('omitted from causal review')));
});
test('changed visual inputs invalidate review but unrelated project title does not',async()=>{
 const {project}=fixture();project.title='New name';assert.equal((await inspectProjectProduction(project,options)).canExpand,true);
 project.scenes[0].document.layers.L.base={x:25};assert.equal((await inspectProjectProduction(project,options)).canExpand,false);
});
test('transition rejects scene-save race even when project revision stays unchanged',async()=>{
 const {project}=fixture();let current=structuredClone(project),wrote=false;
 const store={get:()=>structuredClone(current),transaction:fn=>fn(),db:{prepare:()=>({run:()=>{wrote=true;}})}};
 await assert.rejects(transitionProduction(store,'p',{revision:1,action:'complete'},{...options,readEvidence:async p=>{current.scenes[0].document.layers.L.base={x:5};return p;}}),/changed during evidence/);assert.equal(wrote,false);
});
test('HTTP cannot force complete by submitting a caller pass flag; drafts stay writable',async()=>{
 const store=new ProjectStore(':memory:');store.create('Fixture','p');let handler;
 productionWorkflowPlugin({store}).configureServer({middlewares:{use:fn=>{handler=fn;}}});
 const server=createServer((req,res)=>handler(req,res,()=>res.end()));await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
 try{
  const state=await (await fetch(base+'/api/production-workflows/p')).json();assert.equal(state.canExpand,false);
  const response=await fetch(base+'/api/production-workflows/p',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({revision:0,action:'complete',pass:true,canExpand:true})});
  assert.equal(response.status,409);assert.equal((await response.json()).code,'PRODUCTION_GATE_FAILED');
  assert.equal(store.db.prepare("SELECT count(*) AS n FROM meta WHERE key LIKE 'production-transition:%'").get().n,0);
  assert.equal(store.update('p',{revision:0,title:'Draft still editable'}).title,'Draft still editable');
 }finally{await new Promise(ok=>server.close(ok));store.close();}
});
