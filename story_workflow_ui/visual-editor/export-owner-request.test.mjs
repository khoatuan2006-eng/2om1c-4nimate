import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareExportOwnerRequest} from './export-owner-request.mjs';
const request={requestId:'11111111-1111-4111-8111-111111111111',scale:.5};
test('owner UI preparation stamps complete receipt rather than treating GET gate as authorization',async()=>{
 const calls=[],fingerprint='f'.repeat(64);
 const prepared=await prepareExportOwnerRequest('fixture',request,async(path,options)=>{calls.push({path,options});return Response.json(options?{projectRevision:2,fingerprint,receipt:{action:'complete',fingerprint}}:{projectRevision:2,canExpand:true});});
 assert.deepEqual(JSON.parse(calls[1].options.body),{revision:2,action:'complete'});
 assert.deepEqual(prepared,{command:'authorize-export',projectId:'fixture',revision:2,fingerprint,...request});
 assert.equal(calls.length,2,'No API grants owner authorization');
});
test('no owner request is emitted for a failed gate or a scene race after reading it',async()=>{
 let calls=0;await assert.rejects(prepareExportOwnerRequest('fixture',request,async()=>{calls++;return Response.json({canExpand:false});}),/kiểm tra bản dựng/);assert.equal(calls,1);
 await assert.rejects(prepareExportOwnerRequest('fixture',request,async(path,options)=>options?Response.json({error:'Saved scene changed'},{status:409}):Response.json({projectRevision:2,canExpand:true})),/Saved scene changed/);
});
