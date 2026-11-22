import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestSceneResource} from './create-scene-api.mjs';
test('scene requests preserve HTTP status on broken replies and use retry guidance for uncertain writes',async()=>{
 for(const status of [404,409,429,500,507])await assert.rejects(requestSceneResource('/api/test',undefined,async()=>new Response('<html>Failure</html>',{status})),error=>error.status===status&&error.code==='INVALID_RESPONSE');
 for(const name of ['TypeError','TimeoutError','AbortError']){
  const failure=Object.assign(Error('Transport failed'),{name});
  await assert.rejects(requestSceneResource('/api/test',{id:'same'},async()=>{throw failure;}),error=>error.code==='CONNECTION_UNCONFIRMED'&&/kiểm tra lại công việc/.test(error.message));
 }
 const reply=await requestSceneResource('/api/test',{id:'same'},async(_path,options)=>{assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{id:'same'});assert.ok(options.signal);return new Response('{"status":"queued"}',{status:202});});assert.equal(reply.status,'queued');
 await assert.rejects(requestSceneResource('/api/test',undefined,async()=>new Response('null')),error=>error.code==='INVALID_RESPONSE');
});
test('an unresponsive audio request aborts after the actual request deadline',async()=>{
 const started=Date.now();
 // Keep the test process live: AbortSignal.timeout itself is unref'ed in Node.
 const keepAlive=setInterval(()=>{},1000);
 try{await assert.rejects(requestSceneResource('/api/created-scenes/audio',{id:'same'},async(_path,{signal})=>new Promise((_ok,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))),error=>error.code==='CONNECTION_UNCONFIRMED');assert.ok(Date.now()-started>=14000);}
 finally{clearInterval(keepAlive);}
});
