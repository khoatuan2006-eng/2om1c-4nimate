import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestExport,assertExportJob} from './export-api.mjs';
const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const job={id,projectId:'P',status:'rendering',progress:20,scale:1};
test('export reads are scoped to project and job with a deadline and no cache',async()=>{
 let request;
 assert.deepEqual(await requestExport({projectId:'P',fetcher:async(url,options)=>{request={url,options};return Response.json([job]);}}),[job]);
 assert.equal(request.url,'/api/exports?project=P');assert.equal(request.options.cache,'no-store');assert.ok(request.options.signal instanceof AbortSignal);
 for(const changed of [{...job,scale:2},{...job,projectId:'other'},{...job,id:'bad'},{...job,progress:Infinity},{...job,status:'unknown'},{...job,status:'complete',fileUrl:'https://other/video'}])assert.throws(()=>assertExportJob(changed,'P'),{code:'INVALID_RESPONSE'});
 await assert.rejects(requestExport({projectId:'P',id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',fetcher:async()=>Response.json(job)}),{code:'INVALID_RESPONSE'});
 await assert.rejects(requestExport({projectId:'P',fetcher:async()=>Response.json({})}),{code:'INVALID_RESPONSE'});
});
test('export mutation failures are surfaced without automatically sending again',async()=>{
 let calls=0;
 await assert.rejects(requestExport({projectId:'P',body:{projectId:'P',scale:1},fetcher:async(_url,options)=>{calls++;assert.equal(options.method,'POST');assert.ok(options.signal);throw new DOMException('timed out','TimeoutError');}}),{code:'CONNECTION_UNCONFIRMED'});
 assert.equal(calls,1);
 await assert.rejects(requestExport({projectId:'P',fetcher:async()=>new Response('bad json')}),{code:'INVALID_RESPONSE'});
});
