import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {testRuntime} from './test-runtime.mjs';
let f,BackupOperations;
before(async()=>{f=await testRuntime();({BackupOperations}=await import('./backup-server.mjs'));});after(async()=>{await f?.close();});
test('backup API creates/verifies an online snapshot and reports corruption without replacing current edits',async()=>{
 const project=f.store.create('Backup fixture');f.store.addScene(project.id,{id:'one',title:'One',kind:'created',duration:30,shots:[{from:0,to:30}],cues:[]},{version:1,revision:0,layers:{}});
 assert.equal((await f.request('/api/backups',{},'POST','https://outside.example')).status,403);
 const [first,second]=await Promise.all([f.request('/api/backups',{}),f.request('/api/backups',{})]);assert.deepEqual([first.status,second.status].sort(),[201,409]);
 const saved=await(first.status===201?first:second).json();assert.equal(saved.projects,1);assert.equal(saved.scenes,1);assert.equal(saved.status,'verified');
 const list=await fetch(f.base+'/api/backups').then(r=>r.json());assert.equal(list.backups.length,1);assert.equal(list.active,null);
 assert.equal((await f.request('/api/backups/'+saved.id+'/verify',{})).status,200);
 const file=join(f.folder,'data/backups',saved.id,'projects.sqlite'),original=await readFile(file);await writeFile(file,Buffer.concat([original,Buffer.from('corrupt')]));
 const bad=await f.request('/api/backups/'+saved.id+'/verify',{});assert.equal(bad.status,400);assert.match((await bad.json()).error,/hash/);assert.equal(f.store.get(project.id).scenes.length,1);
 assert.equal((await f.request('/api/backups/not-a-backup/verify',{})).status,404);
});
test('shutdown waits for an in-flight backup and rejects new work without releasing it early',async()=>{
 const operations=new BackupOperations();let finish;const pending=operations.run('create',()=>new Promise(ok=>finish=ok));await Promise.resolve();let stopped=false;const close=operations.shutdown().then(()=>stopped=true);
 assert.equal(stopped,false);assert.throws(()=>operations.run('verify',()=>{}),error=>error.status===503);finish('saved');assert.equal(await pending,'saved');await close;assert.equal(stopped,true);assert.equal(operations.active,null);
 const failed=new BackupOperations();await assert.rejects(failed.run('verify',async()=>{throw Error('bad hash')}),/bad hash/);await failed.shutdown();
});
