import {test,before,after} from 'node:test';
import {testRuntime} from './test-runtime.mjs';
import assert from 'node:assert/strict';
let fixture,base;
before(async()=>{fixture=await testRuntime();base=fixture.base+'/api/library';});after(async()=>{await fixture?.close();});
test('discovery rejects foreign-origin extraction and unknown source tokens',async()=>{
 const denied=await fetch(base+'/discovery/import?token=unknown',{method:'POST',headers:{Origin:'https://example.com'}});assert.equal(denied.status,403);
 const missing=await fetch(base+'/discovery/import?token=unknown',{method:'POST',headers:{Origin:fixture.base}});assert.equal(missing.status,404);
});
test('discovery requires a description and never exposes credentials',async()=>{
 const empty=await fetch(base+'/discovery/search',{method:'POST',headers:{Origin:fixture.base,'Content-Type':'application/json'},body:JSON.stringify({query:''})});assert.equal(empty.status,400);
 const status=await (await fetch(base+'/discovery/status')).json();assert.deepEqual(Object.keys(status),['geminiConfigured']);assert.equal(typeof status.geminiConfigured,'boolean');
});
