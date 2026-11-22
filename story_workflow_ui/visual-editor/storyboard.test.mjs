import {validateDocument} from './model.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {createServer} from 'node:http';
import {ProjectStore} from './project-store.mjs';import {projectPlugin} from './project-server.mjs';
import {compileScriptPlan} from './script-plan.mjs';import {storyboardRows,patchStoryboard,replaceStoryboardAsset} from './storyboard-model.mjs';import {inspectProduction} from './production-contract.mjs';
const plan=JSON.parse(await readFile(new URL('../script-analysis/EP02/studio-plan.json',import.meta.url),'utf8')),compiled=compileScriptPlan(plan);
test('storyboard groups source tasks into existing shots and preserves timings and lock scope',()=>{const project={lockedPrefix:[plan.id],scenes:[{...compiled.source,document:compiled.document}]},rows=storyboardRows(project);assert.equal(rows.length,7);assert.equal(rows.reduce((n,r)=>n+r.tasks.length,0),14);assert.ok(rows.every(r=>r.locked));assert.equal(rows.at(-1).to,692);});
test('planning changes never silently replace source, layers or audio',()=>{const doc=patchStoryboard(compiled.source,compiled.document,'T03',{intent:'Cut to target',narrationDraft:'A proposed line',status:'todo'});assert.deepEqual(doc.layers,compiled.document.layers);assert.equal(compiled.document.storyboard,undefined);assert.equal(doc.storyboard.tasks.T03.narrationDraft,'A proposed line');assert.equal(inspectProduction(compiled.source.scriptPlan.tasks,doc).ok,false);});
test('reject orphan tasks, invalid state and arbitrary document fields',()=>{for(const [id,patch] of [['missing',{intent:'x'}],['T03',{status:'approved'}],['T03',{layers:{}}],['T03',{notes:'x'.repeat(4001)}]])assert.throws(()=>patchStoryboard(compiled.source,compiled.document,id,patch));});
test('resource replacement changes exactly one asset while preserving timing, transform and keys',()=>{
 const id=plan.id+'/shot-0/T05b-hero',before=compiled.document.layers[id],src='library-assets/'+'a'.repeat(64)+'.png';const next=replaceStoryboardAsset(compiled.document,id,{name:'Alternative pose',type:'characters',width:200,height:400,parts:[{src,left:0,top:0,width:200,height:400}]});
 assert.equal(Object.keys(next.layers).length,Object.keys(compiled.document.layers).length);assert.equal(next.layers[id].asset.from,before.asset.from);assert.equal(next.layers[id].asset.to,before.asset.to);assert.deepEqual(next.layers[id].keys,before.keys);assert.deepEqual(next.layers[id].base,before.base);assert.notEqual(next.layers[id].asset.parts[0].src,before.asset.parts[0].src);validateDocument(next,plan.duration);assert.throws(()=>replaceStoryboardAsset(compiled.document,id,{type:'backgrounds',width:1,height:1,parts:[]}),/Tài nguyên/);
});
test('normal editor saves cannot bypass storyboard schema validation',()=>{const doc=structuredClone(compiled.document);doc.storyboard={version:1,tasks:{T03:{status:'approved'}}};assert.throws(()=>validateDocument(doc,plan.duration),/storyboard/);});
test('versioned API isolates the scene, rejects stale/foreign/locked writes and retains history',async()=>{
 const store=new ProjectStore(':memory:');store.create('one','p1');store.create('two','p2');store.addScene('p1',compiled.source,compiled.document);let handler;projectPlugin({store}).configureServer({middlewares:{use:fn=>handler=fn}});
 const server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
 const save=(project,revision,changes,origin=base)=>fetch(base+'/api/projects/'+project+'/scenes/'+plan.id+'/storyboard',{method:'PATCH',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({revision,taskId:'T03',changes})});
 try{
  assert.equal((await save('p1',0,{notes:'test'},'http://external.invalid')).status,403);assert.equal((await save('p2',0,{notes:'foreign'})).status,404);
  assert.equal((await save('p1',0,{notes:'Saved note',intent:'Cut to wall target'})).status,200);
  assert.equal((await save('p1',0,{notes:'stale'})).status,409);assert.equal(store.getEdits(plan.id,'p1').storyboard.tasks.T03.notes,'Saved note');assert.equal(store.history(plan.id,'p1').length,1);
  assert.deepEqual(store.getEdits(plan.id,'p1').layers,compiled.document.layers);assert.deepEqual(JSON.parse(store.scene(plan.id,'p1').source).cues,compiled.source.cues);
  store.db.prepare('UPDATE projects SET locked_prefix=? WHERE id=?').run(JSON.stringify([plan.id]),'p1');assert.equal((await save('p1',1,{notes:'locked'})).status,409);assert.equal(store.getEdits(plan.id,'p1').revision,1);
  assert.equal(store.get('p2').revision,0);
 }finally{await new Promise(ok=>server.close(ok));store.close();}
});
