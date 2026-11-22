import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {testRuntime} from './test-runtime.mjs';
import {fixtureProductionReceipt} from './test-fixtures/production-receipt.mjs';
test('HTTP export replay after the server drops the accepted response returns the same persisted job',async()=>{
 const f=await testRuntime();try{
  const {getExportJobs}=await import('./export-server.mjs'),jobs=getExportJobs();jobs.workerPath=resolve(import.meta.dirname,'test-fixtures/export-process.mjs');
  const project=f.store.create('HTTP replay fixture');
  f.store.addScene(project.id,{id:'NEW-'+randomUUID(),kind:'created',title:'One',duration:30,cues:[]},{version:1,revision:0,layers:{}});
  const productionReceipt=fixtureProductionReceipt(f.store,project.id);
  const requestId=randomUUID(),body={projectId:project.id,scale:.5,requestId};let dropped=false;
  assert.equal((await f.request('/api/exports',body)).status,403,'Quality receipt alone cannot authorize an export');
  f.app.authorizeExport({projectId:project.id,revision:f.store.get(project.id).revision,fingerprint:productionReceipt.fingerprint,requestId,scale:.5});
  const drop=(req,res)=>{if(req.method==='POST'&&req.url==='/api/exports'&&!dropped){dropped=true;res.end=()=>{res.destroy();return res;};}};
  f.app.server.prependListener('request',drop);
  await assert.rejects(f.request('/api/exports',body));
  f.app.server.removeListener('request',drop);
  const scene=f.store.get(project.id).scenes[0];f.store.saveEdits(scene.id,scene.document,project.id);
  assert.equal((await f.request('/api/exports',{...body,requestId:randomUUID()})).status,409,'New export needs a current review after editing');
  const response=await f.request('/api/exports',body),job=await response.json();
  assert.equal(response.status,202);assert.equal(job.id,requestId);assert.equal(job.requestId,requestId);assert.equal(job.scale,.5);
  const list=await (await fetch(f.base+'/api/exports?project='+project.id)).json();assert.equal(list.length,1);assert.equal(list[0].id,requestId);
  const mismatch=await f.request('/api/exports',{...body,scale:1});assert.equal(mismatch.status,409);
  await jobs.shutdown();
  const terminal=await (await f.request('/api/exports',body)).json();assert.equal(terminal.id,requestId);assert.equal(terminal.status,'cancelled');assert.equal(jobs.workers.size,0);
 }finally{await f.close();}
});
