import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {testRuntime} from './test-runtime.mjs';
import {createStudioMcp} from './studio-mcp.mjs';
import {productionStudioTools} from './production-client.mjs';
import {join} from 'node:path';
import {storyHash} from './story-chain.mjs';
import {atomicWriteBytes} from './atomic-write.mjs';
import {capturePreviewEvidence} from './preview-evidence.mjs';

test('adapter rejects remote origins, embedded credentials and missing project binding',()=>{
 for(const baseUrl of ['https://example.com','http://example.com','http://localhost/api','http://user:secret@localhost','http://localhost/?path=x'])assert.throws(()=>createStudioMcp({baseUrl,projectId:'p'}),/loopback/);
 assert.throws(()=>createStudioMcp({projectId:'../other'}));assert.throws(()=>createStudioMcp());
});
test('SDK stdio client reaches real Studio API: dry-run, apply, replay, stale revision, locks, transitions and reconnect',{timeout:30000},async()=>{
 const f=await testRuntime();let client,transport;
 const connect=async()=>{
  transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./studio-mcp.mjs',import.meta.url))],env:{...process.env,STUDIO_URL:f.base,STUDIO_PROJECT_ID:'mcp-fixture'},stderr:'pipe'});
  client=new Client({name:'isolated-acceptance-client',version:'1.0.0'});await client.connect(transport);
 };
 const call=(name,args={})=>client.callTool({name,arguments:args});
 try{
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=','base64'),imageHash=storyHash(png),mediaDirectory=join(f.folder,'data','media');await atomicWriteBytes(join(mediaDirectory,'library-assets',imageHash+'.png'),png);
  f.store.create('MCP fixture','mcp-fixture');await connect();const emptyState=await call('studio_state');assert.equal(emptyState.structuredContent.value.project.scenes.length,0);assert.equal(emptyState.structuredContent.value.nextAction,'import-first-scene-or-build-episode-draft');f.store.addScene('mcp-fixture',{id:'S',title:'Draft',duration:90,kind:'created',cues:[],shots:[{from:0,to:90}]},{version:1,revision:0,layers:{'S/shot-0/object':{base:{x:0},asset:{name:'Fixture',type:'characters',from:0,to:90,left:0,top:0,width:1,height:1,parts:[{src:'library-assets/'+imageHash+'.png',left:0,top:0,width:1,height:1}]}}}});
  const names=(await client.listTools()).tools.map(t=>t.name);assert(names.includes('studio_author_batch'));assert(!names.includes('exec'));assert(!names.includes('studio_export'));
  assert.deepEqual(names.toSorted(),productionStudioTools.toSorted(),'Review explicit production permissions when changing the shared MCP interface');
  let state=await call('studio_state');assert.equal(state.structuredContent.value.project.id,'mcp-fixture');assert.equal(state.structuredContent.value.production.canExpand,false);
  assert.equal(state.structuredContent.value.project.scenes[0].documentRevision,0);
  assert.equal(state.structuredContent.value.project.scenes[0].document,undefined,'Resume cursor must not duplicate scene layers/media');
  assert.equal(state.structuredContent.value.episode.project,undefined,'Episode summary must not repeat the whole project');
  const uploaded=await call('studio_supplement_register',{pngBase64:png.toString('base64'),record:{version:1,name:'MCP upload fixture',type:'props',purpose:'Synthetic transport fixture',tags:['mcp-fixture'],capabilities:['static'],limitations:['Not production art'],provenance:{kind:'unknown'},review:{status:'candidate'}}});assert.equal(uploaded.isError,undefined);assert.equal(uploaded.structuredContent.value.projectId,'mcp-fixture');
  const search=await call('studio_catalog_search',{query:'MCP upload fixture'});assert.equal(search.structuredContent.value.items[0].id,uploaded.structuredContent.value.id);
  // Renderer injected only for the registry/image transport fixture; real Remotion capture has its separate integration check.
  const captured=await capturePreviewEvidence(f.store,'mcp-fixture',{sceneId:'S',documentRevision:0,frames:[0]},{mediaDirectory,workDirectory:join(f.folder,'work'),render:async()=>[png]});
  const captureId=captured.evidence[0].captureId;
  const picture=await call('studio_capture_image',{captureId});assert.equal(picture.content[0].type,'image');assert.deepEqual(Buffer.from(picture.content[0].data,'base64'),png);
  const foreign=f.store.create('Other project','foreign-fixture');assert.equal((await fetch(f.base+'/api/preview-evidence/'+foreign.id+'/'+captureId)).status,400);
  const args={sceneId:'S',batchId:'move-1',revision:0,commands:[{op:'transform',layerId:'S/shot-0/object',values:{x:25}}]};
  const dry=await call('studio_author_batch',args);assert.equal(dry.isError,undefined,JSON.stringify(dry));assert.equal(dry.structuredContent.value.dryRun,true);assert.equal(f.store.getEdits('S','mcp-fixture').revision,0);
  const applied=await call('studio_author_batch',{...args,dryRun:false});assert.equal(applied.structuredContent.value.document.revision,1);
  assert.equal((await call('studio_capture_image',{captureId})).isError,true,'Saved visual edit makes the old capture stale');
  const replay=await call('studio_author_batch',{...args,dryRun:false});assert.equal(replay.structuredContent.value.reused,true);assert.equal(f.store.getEdits('S','mcp-fixture').revision,1);
  const stale=await call('studio_author_batch',{...args,batchId:'move-2',dryRun:false});assert.equal(stale.isError,true);assert.equal(stale.structuredContent.httpStatus,409);
  const forced=await call('studio_transition',{revision:1,action:'complete'});assert.equal(forced.isError,true);assert.equal(forced.structuredContent.code,'PRODUCTION_GATE_FAILED');
  const exportAttempt=await call('studio_export_request',{requestId:'11111111-1111-4111-8111-111111111111',scale:1});assert.equal(exportAttempt.isError,true);assert.equal((await call('studio_export_jobs')).structuredContent.value.length,0);
  f.store.db.prepare('UPDATE projects SET locked_prefix=? WHERE id=?').run('["S"]','mcp-fixture');
  const locked=await call('studio_author_batch',{...args,revision:1,batchId:'move-3',dryRun:false});assert.equal(locked.isError,true);assert.equal(locked.structuredContent.httpStatus,409);
  const wrong=await call('studio_scene_read',{sceneId:'Other'});assert.equal(wrong.isError,true);
  assert(names.includes('studio_preview_play'));assert(names.includes('studio_preview_status'));assert(!names.some(name=>name.includes('claim')),'Agent must not impersonate the Studio Player');
  const preview=await call('studio_preview_play',{sceneId:'S',documentRevision:1,from:0,to:30});assert.equal(preview.isError,undefined);assert.equal(preview.structuredContent.value.status,'queued');
  const previewId=preview.structuredContent.value.requestId;assert.equal((await call('studio_preview_status',{requestId:previewId})).structuredContent.value.sceneId,'S');
  assert.equal((await fetch(f.base+'/api/preview-playback/'+foreign.id+'/requests/'+previewId)).status,409,'A foreign project cannot read this command');
  await client.close();await connect();
  state=await call('studio_scene_read',{sceneId:'S'});assert.equal(state.structuredContent.value.scene.document.revision,1);assert.equal(state.structuredContent.value.scene.document.layers['S/shot-0/object'].base.x,25);
  state=await call('studio_state');assert.equal(state.structuredContent.value.project.scenes[0].documentRevision,1);assert.deepEqual(state.structuredContent.value.project.lockedPrefix,['S']);
 }finally{await client?.close();await transport?.close();await f.close();}
});
