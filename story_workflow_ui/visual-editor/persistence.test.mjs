import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {testRuntime} from './test-runtime.mjs';
let fixture,endpoint;
before(async()=>{fixture=await testRuntime();const p=fixture.store.create('Persistence fixture');fixture.store.addScene(p.id,{id:'isolated',title:'test',kind:'created',duration:90,shots:[{from:0,to:90}],cues:[]},{version:1,revision:0,layers:{}});fixture.store.saveEdits('isolated',{version:1,revision:0,layers:{}},p.id);endpoint=`/api/edits?scene=isolated&project=${p.id}`;});
after(async()=>{await fixture?.close();});
test('isolated persistence rejects invalid writes and conflicting revisions without changing authoritative state',async()=>{
 const {base,request}=fixture;const before=await fetch(base+endpoint).then(r=>r.json());
 const put=(body,origin=base)=>request(endpoint,body,'PUT',origin);
 assert.equal((await put({...before,layers:{'isolated/shot-0/test':{base:{scale:0}}}})).status,400);
 assert.equal((await put({...before,layers:{'foreign/shot-0/test':{base:{x:1}}}})).status,400);
 assert.equal((await put(before,'http://external.example')).status,403);
 assert.equal((await put({...before,revision:before.revision-1})).status,409);
 assert.deepEqual(await fetch(base+endpoint).then(r=>r.json()),before);
});
