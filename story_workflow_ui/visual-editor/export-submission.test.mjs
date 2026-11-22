import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pendingExport,reserveExport,acknowledgeExport} from './export-submission.mjs';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
function storage(){const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
test('lost export receipt preserves request identity and scale until the matching receipt is confirmed',()=>{
 const store=storage(),request=reserveExport(store,'P',.5,id);
 assert.deepEqual(pendingExport(store,'P'),request);
 assert.deepEqual(reserveExport(store,'P',1,other),request);
 assert.equal(pendingExport(store,'other'),null);
 assert.throws(()=>acknowledgeExport(store,request,{id:other,requestId:other,projectId:'P',scale:.5}));
 assert.deepEqual(pendingExport(store,'P'),request);
 acknowledgeExport(store,request,{id,requestId:id,projectId:'P',scale:.5});
 assert.equal(pendingExport(store,'P'),null);
 assert.equal(reserveExport(store,'P',1,other).requestId,other);
});
test('quota, corrupt request and silent storage failures prevent issuing a new export request',()=>{
 assert.throws(()=>reserveExport({getItem:()=>null,setItem:()=>{throw Error('quota');}},'P',1,id),/chưa gửi/);
 assert.throws(()=>reserveExport({getItem:()=>null,setItem:()=>{}},'P',1,id),/chưa gửi/);
 assert.throws(()=>pendingExport({getItem:()=>'{broken'},'P'),/Không đọc/);
 assert.throws(()=>pendingExport({getItem:()=>JSON.stringify({requestId:id,projectId:'other',scale:1})},'P'),/không hợp lệ/);
});
