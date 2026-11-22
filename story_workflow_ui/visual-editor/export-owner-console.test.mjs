import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';
import {testRuntime} from './test-runtime.mjs';
import {fixtureProductionReceipt} from './test-fixtures/production-receipt.mjs';
import {attachExportOwnerConsole} from './export-owner-console.mjs';

test('trusted console grants exact pending request; HTTP cannot grant and retry reserves one fake worker',async()=>{
 const f=await testRuntime(),input=new PassThrough(),output=new PassThrough(),error=new PassThrough();let stdout='',stderr='';output.on('data',b=>stdout+=b);error.on('data',b=>stderr+=b);
 const stop=attachExportOwnerConsole(f.app,{input,output,error});
 try{
  const {getExportJobs}=await import('./export-server.mjs'),jobs=getExportJobs();jobs.workerPath=resolve(import.meta.dirname,'test-fixtures/export-process.mjs');
  f.store.create('Owner console fixture','owner-console-fixture');f.store.addScene('owner-console-fixture',{id:'S',title:'Synthetic fixture',kind:'created',duration:30,cues:[]},{version:1,revision:0,layers:{}});
  const project=f.store.get('owner-console-fixture'),receipt=fixtureProductionReceipt(f.store,project.id),requestId=randomUUID(),request={projectId:project.id,requestId,scale:.5};
  assert.equal((await f.request('/api/exports',request)).status,403);assert.equal((await jobs.list()).length,0);
  const command={command:'authorize-export',projectId:project.id,revision:project.revision,fingerprint:receipt.fingerprint,requestId,scale:.5};
  assert.equal((await f.request('/api/authorize-export',command)).status,404);
  input.write('{bad json}\n');input.write(JSON.stringify({...command,command:'unknown'})+'\n');assert.match(stderr,/Owner command:/);assert.equal(stdout,'');
  input.write(JSON.stringify(command)+'\n');assert.equal(JSON.parse(stdout.trim()).requestId,requestId);
  assert.equal((await f.request('/api/exports',{...request,scale:1})).status,403);
  const accepted=await f.request('/api/exports',request);assert.equal(accepted.status,202);const job=await accepted.json();assert.equal(job.id,requestId);
  assert.equal((await f.request('/api/exports',request)).status,202);assert.equal((await jobs.list()).length,1);
  input.write(JSON.stringify(command)+'\n');assert.match(stderr,/already consumed/);
  await jobs.shutdown();assert.equal((await jobs.get(job.id)).status,'cancelled');
 }finally{stop();input.destroy();output.destroy();error.destroy();await f.close();}
});
