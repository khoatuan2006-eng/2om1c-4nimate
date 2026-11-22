import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ProjectStore} from './project-store.mjs';
import {compileScriptPlan} from './script-plan.mjs';
import {chainFingerprint,storyHash} from './story-chain.mjs';
import {inspectProjectProduction,productionFingerprint} from './production-workflow.mjs';
import {productionWorkflowPlugin} from './production-workflow-server.mjs';
import {productionApi,readProductionSnapshot} from './production-api-client.mjs';
import {runStoryChain} from './story-chain-cli.mjs';
import {auditProduction} from './production-audit.mjs';
const run=promisify(execFile);

test('audit and story CLI cannot clear the server gate using checksum-valid local evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'doyin-review-')),store=new ProjectStore(':memory:',{mediaDirectory:dir});
 let server;
 try{
  const plan=JSON.parse(await readFile(new URL('../script-analysis/EP02/studio-plan.json',import.meta.url),'utf8')),compiled=compileScriptPlan(plan);
  store.create('Isolated CLI fixture','test-project');store.addScene('test-project',compiled.source,compiled.document);
  const project=store.get('test-project'),scene=project.scenes[0],tasks=scene.scriptPlan.tasks;
  const chain={version:1,id:'route',steps:[{id:'look',before:'Hero in alley',actor:'Hero',action:'Looks toward route',target:'Wall',response:'Attention changes',result:'Wall recognized',visibleChange:'Wall revealed',dependsOn:[],taskRefs:tasks.map(t=>({sceneId:scene.id,taskId:t.id})),resources:[{sceneId:scene.id,layerId:tasks[0].layerIds[0],use:'Shows the location'}]}]};
  const evidence=[];
  for(const [i,phase] of ['before','action','result'].entries()){
   const path=join(dir,phase+'.png'),bytes=Buffer.from('untrusted external render '+phase);await writeFile(path,bytes);
   evidence.push({stepId:'look',phase,sceneId:scene.id,frame:tasks[0].from+Math.floor((tasks[0].to-tasks[0].from-1)*i/2),path,sha256:storyHash(bytes),observation:'Saw '+phase});
  }
  chain.review={fingerprint:chainFingerprint(chain,project),outcome:'pass',issues:[],steps:[{id:'look',outcome:'pass',observedChange:'Wall revealed'}],evidence,playback:{watched:true,ranges:[{sceneId:scene.id,from:0,to:scene.duration}],observed:'Claimed full playback'}};
  scene.document.storyChains={version:1,chains:{route:chain}};store.saveEdits(scene.id,scene.document,project.id);
  // Missing server verifiers must fail even with readable, checksum-valid files.
  const local=await inspectProjectProduction(store.get(project.id));assert.equal(local.canExpand,false);assert.ok(local.errors.some(e=>e.includes('verifiers unavailable')));
  let gateHandler;productionWorkflowPlugin({store,mediaDirectory:dir}).configureServer({middlewares:{use:fn=>{gateHandler=fn;}}});
  server=createServer(async(req,res)=>{
   res.setHeader('Content-Type','application/json');
   try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/health')return res.end(JSON.stringify({status:'ready',runtime:'standalone',agentProtocol:{name:'doyin-studio-production',version:1},identity:'a'.repeat(64),version:'b'.repeat(64)}));
    if(url.pathname==='/api/projects/test-project')return res.end(JSON.stringify(store.get(project.id)));
    if(url.pathname==='/api/edits'&&req.method==='PUT'){
     let raw='';for await(const chunk of req)raw+=chunk;
     return res.end(JSON.stringify(store.saveEdits(url.searchParams.get('scene'),JSON.parse(raw),url.searchParams.get('project'))));
    }
    await gateHandler(req,res,()=>{res.statusCode=404;res.end('{}');});
   }catch(error){res.statusCode=error.status??400;res.end(JSON.stringify({error:error.message,code:error.code}));}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
  const auditArgs=['visual-editor/production-audit.mjs','--project='+project.id,'--scene='+scene.id,'--url='+base];
  const invoke=async args=>JSON.parse((await run(process.execPath,args,{cwd:resolve(import.meta.dirname,'..'),windowsHide:true})).stdout);
  const first=await invoke(auditArgs);assert.equal(first.preflight.ok,true);assert.equal(first.canExpand,false);assert.equal(first.review.current,false);
  assert.ok(first.errors.some(e=>e.includes('Studio phát hành')));assert.ok(first.errors.some(e=>e.includes('Playback')));
  const legacy=join(dir,'legacy-review.json');await writeFile(legacy,JSON.stringify({projectId:project.id,sceneId:scene.id,visualDigest:first.visualDigest,sourceDigest:first.sourceDigest,recipeDigest:first.recipeDigest,outcome:'pass',issues:[],evidence}));
  const claimed=await invoke([...auditArgs,'--review='+legacy]);assert.equal(claimed.canExpand,false);assert.match(claimed.review.legacyFileAuthority,/advisory-only/);
  const cli=await invoke(['visual-editor/story-chain-cli.mjs','--mode=check','--project='+project.id,'--scene='+scene.id,'--chain=route','--url='+base]);
  assert.equal(cli.canExpand,false);assert.equal(cli.chainCanExpand,false);assert.match(cli.authority,/production-workflows/);
  const api=await productionApi(base),reviewed=await runStoryChain(api,{mode:'review',projectId:project.id,sceneId:scene.id,chainId:'route',input:chain.review});
  assert.equal(reviewed.canExpand,false);assert.equal(reviewed.documentRevision,2);
  assert.equal(store.getEdits(scene.id,project.id).storyChains.chains.route.review.outcome,'pass');
  // An unverified reviewer claim is saved honestly, but never grants a receipt.
  assert.equal(store.db.prepare("SELECT value FROM meta WHERE key='production-transition:test-project'").get(),undefined);
  store.db.prepare('UPDATE projects SET locked_prefix=? WHERE id=?').run(JSON.stringify([scene.id]),project.id);
  await assert.rejects(runStoryChain(api,{mode:'review',projectId:project.id,sceneId:scene.id,chainId:'route',input:chain.review}),{status:409,code:'SCENE_LOCKED'});
 }finally{
  if(server)await new Promise(ok=>server.close(ok));store.close();assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));await rm(dir,{recursive:true,force:true});
 }
});

test('CLI refuses a gate from another snapshot even when project revision did not change',async()=>{
 const project={id:'p',revision:1,scenes:[]},gate={projectId:'p',projectRevision:1,fingerprint:productionFingerprint(project),canExpand:true,errors:[],chains:[]};
 const saved=structuredClone(project);saved.scenes.push({id:'S',document:{revision:1}});
 await assert.rejects(readProductionSnapshot(async path=>path.includes('production-workflows')?gate:saved,'p'),{status:409});
 await assert.rejects(readProductionSnapshot(async path=>path.includes('production-workflows')?{...gate,projectId:'other'}:project,'p'),{status:409});
});

test('existing scene without a source contract yields an actionable blocked report',async()=>{
 const project={id:'p',revision:1,scenes:[{id:'S',document:{revision:0,layers:{}}}]},gate=await inspectProjectProduction(project);
 const report=await auditProduction(async path=>path.includes('production-workflows')?gate:project,{projectId:'p',sceneId:'S'});
 assert.equal(report.canExpand,false);assert.equal(report.preflight.ok,false);assert.equal(report.nextAction,'fix-contract');assert.ok(report.errors.some(e=>e.includes('missing source/task contract')));
});
