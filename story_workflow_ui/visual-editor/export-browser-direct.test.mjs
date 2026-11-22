import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {testRuntime} from './test-runtime.mjs';

test('local browser direct export works on 127.0.0.1 while blocking foreign origins, non-browser requests, and EDITOR_STRICT_EXPORT=1',async()=>{
 const f=await testRuntime();try{
  const {getExportJobs}=await import('./export-server.mjs'),jobs=getExportJobs();jobs.workerPath=resolve(import.meta.dirname,'test-fixtures/export-process.mjs');
  const project=f.store.create('Local browser direct fixture');
  f.store.addScene(project.id,{id:'NEW-'+randomUUID(),kind:'created',title:'Draft unreviewed',duration:30,cues:[]},{version:1,revision:0,layers:{}});
  const requestId=randomUUID(),baseBody={projectId:project.id,scale:.5,requestId},directBody={...baseBody,browserDirect:true};
  const post=(body,origin=f.base,headers={})=>fetch(f.base+'/api/exports',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});

  // Plain non-browser call (no browserDirect/header, no production receipt) still hits 409 PRODUCTION_GATE_REQUIRED.
  const plain=await post(baseBody);assert.equal(plain.status,409);assert.equal((await plain.json()).code,'PRODUCTION_GATE_REQUIRED');

  // Foreign origin cannot bypass even with browserDirect + header.
  assert.equal((await post(directBody,'http://evil.example',{'X-Studio-Export-Source':'browser-ui'})).status,403);

  // Explicit strict mode keeps the production & terminal owner gates active even for local browser clicks.
  process.env.EDITOR_STRICT_EXPORT='1';
  const strict=await post(directBody,f.base,{'X-Studio-Export-Source':'browser-ui'});assert.equal(strict.status,409);
  delete process.env.EDITOR_STRICT_EXPORT;

  // Local browser direct click on 127.0.0.1 succeeds without terminal owner authorization or pending beat review.
  const accepted=await post(directBody,f.base,{'X-Studio-Export-Source':'browser-ui'});assert.equal(accepted.status,202);
  const job=await accepted.json();assert.equal(job.id,requestId);assert.equal(job.requestId,requestId);assert.equal(job.scale,.5);

  // Replaying the same requestId returns the persisted job idempotently.
  const replay=await post(directBody,f.base,{'X-Studio-Export-Source':'browser-ui'});assert.equal(replay.status,202);assert.equal((await replay.json()).id,requestId);
  await jobs.shutdown();
 }finally{delete process.env.EDITOR_STRICT_EXPORT;await f.close();}
});
