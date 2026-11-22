import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {compileScriptPlan} from './script-plan.mjs';
import {scriptPlanPlugin} from './script-plan-server.mjs';
import {ProjectStore} from './project-store.mjs';
const plan=JSON.parse(await readFile(new URL('../script-analysis/EP02/studio-plan.json',import.meta.url),'utf8'));
test('EP02 compiles 14 tasks into 7 shots using editor document schema',()=>{
 const result=compileScriptPlan(plan);assert.equal(result.source.scriptPlan.tasks.length,14);assert.equal(result.source.shots.length,7);assert.equal(result.source.duration,692);assert.equal(result.source.scriptPlan.coverage,'source-and-structure-only');
});
test('optional gaps normalize for Studio trace without changing input',()=>{const p=structuredClone(plan);delete p.tasks[0].gaps;assert.deepEqual(compileScriptPlan(p).source.scriptPlan.tasks[0].gaps,[]);assert.equal(p.tasks[0].gaps,undefined);});
for(const [name,mutate] of [
 ['stale source',p=>p.sourceText=p.sourceText.replace('kiến trúc','công trình')],
 ['missing meaning',p=>{p.tasks[0].source.end--;p.tasks[0].source.quote=p.sourceText.slice(p.tasks[0].source.start,p.tasks[0].source.end);}],
 ['future dependency',p=>p.tasks[0].dependsOn=['T11']],
 ['changed narration',p=>p.cues[0].text='Nội dung bịa'],
 ['wrong cue',p=>p.tasks[0].cueId='N04'],
 ['missing pose layer',p=>p.tasks[0].layerIds=['missing']],
 ['gap without solution',p=>p.tasks[0].gaps=[{missing:'pose'}]],
 ['task time gap',p=>p.tasks[1].from++],
 ['duplicate shot mapping',p=>p.shots[0].taskIds.push('T02')],
 ['unsafe media path',p=>p.cues[0].publicPath='../secret.mp3']
 ,['invalid screen text',p=>p.tasks[0].screenText={text:'invalid'}]
])test('rejects '+name,()=>{const p=structuredClone(plan);mutate(p);assert.throws(()=>compileScriptPlan(p));});
test('import is revision guarded, retry safe, preserves local edits, verifies media, isolates EP01',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'doyin-plan-')),store=new ProjectStore(':memory:');
 store.create('EP01','ep01');store.create('EP02','ep02');
 const p=structuredClone(plan),bytes=Buffer.from('test-media'),hash=createHash('sha256').update(bytes).digest('hex');
 for(const folder of ['audio','library-assets'])await mkdir(join(dir,folder));
 await writeFile(join(dir,'audio',hash+'.mp3'),bytes);await writeFile(join(dir,'library-assets',hash+'.png'),bytes);
 p.cues.forEach(c=>c.publicPath='audio/'+hash+'.mp3');Object.values(p.document.layers).forEach(l=>l.asset.parts.forEach(part=>part.src='library-assets/'+hash+'.png'));
 let handler;scriptPlanPlugin({store,mediaDirectory:dir}).configureServer({middlewares:{use:h=>handler=h}});
 const server=createServer((req,res)=>handler(req,res,()=>{res.statusCode=404;res.end();}));await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 const send=(revision,plan=p,origin=base)=>fetch(base+'/api/script-plans/import',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({projectId:'ep02',revision,plan})});
 try{
  assert.equal((await send(0,p,'http://external.invalid')).status,403);
  assert.equal((await send(99)).status,409);assert.equal(store.get('ep02').scenes.length,0);
  assert.equal((await send(0)).status,201);
  const doc=store.getEdits(p.id,'ep02');Object.values(doc.layers)[0].base.x=42;store.saveEdits(p.id,doc,'ep02');
  assert.equal((await send(0)).status,200);assert.equal(Object.values(store.getEdits(p.id,'ep02').layers)[0].base.x,42);
  const changed=structuredClone(p);changed.title+=' changed';assert.equal((await send(1,changed)).status,409);
  await writeFile(join(dir,'audio',hash+'.mp3'),'corrupt');assert.equal((await send(1)).status,400);
  assert.equal(store.get('ep02').scenes.length,1);assert.equal(store.get('ep01').revision,0);assert.equal(store.get('ep01').scenes.length,0);
 }finally{await new Promise(ok=>server.close(ok));store.close();await rm(dir,{recursive:true,force:true});}
});
