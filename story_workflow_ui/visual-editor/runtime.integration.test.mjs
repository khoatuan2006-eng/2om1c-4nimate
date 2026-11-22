import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,symlink,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {request as httpRequest} from 'node:http';
import {testRuntime} from './test-runtime.mjs';
let fixture;
before(async()=>{fixture=await testRuntime();});after(async()=>{await fixture?.close();});
test('standalone frontend and readiness work without a Vite process; unknown APIs/assets never return HTML',async()=>{
 const {base}=fixture;
 assert.match(await fetch(base).then(r=>r.text()),/Isolated editor fixture/);
 const health=await fetch(base+'/api/health').then(r=>r.json());assert.equal(health.runtime,'standalone');assert.match(health.version,/^[a-f0-9]{64}$/);
 for(const path of ['/api/missing','/missing.js','/%2eenv','/projects.sqlite'])assert.equal((await fetch(base+path)).status,404);
 const nested=await fetch(base+'/editor/project',{headers:{Accept:'text/html'}});assert.match(await nested.text(),/Isolated editor fixture/);
 const badHost=await new Promise((ok,fail)=>{const req=httpRequest(base+'/api/health',{headers:{Host:'evil.example'}},r=>{r.resume();ok(r.statusCode);});req.on('error',fail);req.end();});assert.equal(badHost,403);
});
test('media uses streaming, HEAD and valid bounded/suffix ranges; traversal and symlink escape cannot expose internal files',async()=>{
 const {folder,base}=fixture;await mkdir(join(folder,'data','media','generated'),{recursive:true});await writeFile(join(folder,'data','media','generated','sample.mp3'),'0123456789');
 const bounded=await fetch(base+'/generated/sample.mp3',{headers:{Range:'bytes=2-4'}});assert.equal(bounded.status,206);assert.equal(bounded.headers.get('content-range'),'bytes 2-4/10');assert.equal(await bounded.text(),'234');
 assert.equal(await fetch(base+'/generated/sample.mp3',{headers:{Range:'bytes=-3'}}).then(r=>r.text()),'789');
 const head=await fetch(base+'/generated/sample.mp3',{method:'HEAD'});assert.equal(head.headers.get('content-length'),'10');assert.equal(await head.text(),'');
 for(const range of ['bytes=-0','bytes=30-40','bytes=4-2','bytes=0-1,3-4'])assert.equal((await fetch(base+'/generated/sample.mp3',{headers:{Range:range}})).status,416);
 const secret=join(folder,'private');await mkdir(secret);await writeFile(join(secret,'secret.txt'),'PRIVATE');
 await symlink(secret,join(folder,'data','media','outside'),'junction');
 assert.equal((await fetch(base+'/outside/secret.txt')).status,404);
 assert.equal((await fetch(base+'/generated/%2e%2e%2f%2e%2e%2fprivate/secret.txt')).status,404);
});
test('project routes share the production store and reject stale/foreign writes on an arbitrary local port',async()=>{
 const {base,request,store}=fixture;
 const created=await request('/api/projects',{title:'Isolated A'});assert.equal(created.status,201);const project=await created.json();
 const other=await request('/api/projects',{title:'Isolated B'}).then(r=>r.json());
 store.addScene(project.id,{id:'test-scene',title:'test',kind:'created',duration:90,shots:[{from:0,to:90}],cues:[]},{version:1,revision:0,layers:{}});
 const endpoint=`/api/edits?project=${project.id}&scene=test-scene`;
 const document={version:1,revision:0,layers:{'test-scene/shot-0/object':{base:{x:40}}}};
 assert.equal((await request(endpoint,document,'PUT')).status,200);
 assert.equal((await request(endpoint,document,'PUT')).status,409);
 assert.equal((await request(endpoint,{...document,revision:1},'PUT','https://external.example')).status,403);
 assert.equal((await fetch(base+`/api/edits?project=${other.id}&scene=test-scene`)).status,404);
 assert.equal((await request('/api/projects',null)).status,400);
 assert.equal((await request('/api/exports',{projectId:project.id,scale:.123})).status,400);
 assert.equal((await request('/api/created-scenes/audio',{id:'invalid',text:'hello',voiceId:'invalid'})).status,400);
 const unchanged=await fetch(base+endpoint).then(r=>r.json());assert.equal(unchanged.revision,1);assert.equal(unchanged.layers['test-scene/shot-0/object'].base.x,40);
});
test('startup fails with an actionable message when the built frontend is missing',async()=>{
 const {createEditorRuntime}=await import('./runtime-server.mjs');await assert.rejects(()=>createEditorRuntime({frontendRoot:join(fixture.folder,'missing')}),/video:edit:build/);
});
