import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EditSession,saveEdits,restoreEdits,loadLatestEdits,prepareConflictResolution,saveFailureMessage,isSceneLockedError,isRevisionConflict} from './edit-session.mjs';
import {createBrowserCache} from './browser-cache.mjs';
const deferred=()=>{let resolve;const promise=new Promise(ok=>resolve=ok);return {promise,resolve};};
test('locked scenes never offer revision resolution; structured and legacy conflicts remain distinguishable',()=>{
 for(const error of [{status:409,code:'SCENE_LOCKED',message:'Protected'},{status:409,message:'Scene đã được duyệt và khóa. Hãy tạo bản sao trước khi chỉnh sửa.'}]){
  assert.equal(isSceneLockedError(error),true);assert.equal(isRevisionConflict(error),false);assert.match(saveFailureMessage(error),/đã được duyệt và khóa/);assert.doesNotMatch(saveFailureMessage(error),/cửa sổ khác/);
 }
 for(const error of [{status:409,code:'REVISION_CONFLICT'},{status:409},{status:409,code:'INVALID_RESPONSE'}])assert.equal(isRevisionConflict(error),true);
 for(const error of [{status:409,code:'SCHEMA_TOO_NEW'},{status:403},{status:500},null])assert.equal(isRevisionConflict(error),false);
});
test('200 receipts missing schema, wrong revision, wrong layers or scene never acknowledge or clear a draft',async()=>{
 const session=new EditSession();session.select('p:s');const document={version:1,revision:4,layers:{'s/shot-0/a':{base:{x:10}}}};
 const replies=[null,{},[],{version:1,revision:4,layers:document.layers},{version:1,revision:6,layers:document.layers},{version:1,revision:5,layers:{'s/shot-0/a':{base:{x:99}}}},{version:1,revision:5,layers:{'other/shot-0/a':{base:{x:10}}}},{version:1,revision:5,layers:{'s/shot-0/a':{keys:{x:[{frame:30,value:10,easing:'linear'}]}}}}];
 for(const reply of replies){let errors=0;const result=await saveEdits({session,projectId:'p',scene:'s',document,revision:4,duration:30,fetcher:async()=>({ok:true,status:200,json:async()=>reply}),onSaved:()=>assert.fail('Bad receipt cleared draft'),onError:error=>{errors++;assert.match(error.code,/INVALID_/);}});assert.equal(result.ok,false);assert.equal(errors,1);assert.equal(document.layers['s/shot-0/a'].base.x,10);}
});
test('valid save receipt accepts different JSON key ordering without losing newer edit isolation',async()=>{
 const session=new EditSession();session.select('p:s');let applied=0;
 const result=await saveEdits({session,projectId:'p',scene:'s',document:{version:1,revision:0,layers:{'s/shot-0/a':{base:{x:10,y:20}}}},revision:0,duration:30,fetcher:async()=>({ok:true,status:200,json:async()=>({version:1,revision:1,layers:{'s/shot-0/a':{base:{y:20,x:10}}}})}),onSaved:()=>applied++,onError:()=>assert.fail('Valid receipt rejected')});assert.equal(result.ok,true);assert.equal(applied,1);
});
test('HTTP failures and malformed JSON preserve status and keep local changes',async()=>{
 const session=new EditSession();session.select('p:s');
 for(const status of [403,409,500,507])for(const malformed of [false,true]){
  const result=await saveEdits({session,projectId:'p',scene:'s',document:{version:1,revision:0,layers:{}},revision:0,fetcher:async()=>({ok:false,status,json:async()=>{if(malformed)throw SyntaxError('HTML reply');return {error:'Storage unavailable',code:'DISK_ERROR'};}}),onSaved:()=>assert.fail(),onError:error=>assert.equal(error.status,status)});assert.equal(result.ok,false);
 }
});
test('latest and restore reject corrupt/foreign documents; restore requires incremented revision and timeout signal',async()=>{
 const session=new EditSession();session.select('p:s');
 await assert.rejects(loadLatestEdits({session,projectId:'p',scene:'s',fetcher:async()=>({ok:true,status:200,json:async()=>({version:1,revision:2,layers:{'elsewhere/shot-0/a':{}}})})}),/không hợp lệ/);
 await assert.rejects(restoreEdits({session,projectId:'p',scene:'s',revision:2,restoreRevision:0,fetcher:async(_url,options)=>{assert.ok(options.signal);return {ok:true,status:200,json:async()=>({version:1,revision:2,layers:{}})};}}),error=>error.code==='INVALID_RESTORE_ACK');
 const result=await restoreEdits({session,projectId:'p',scene:'s',revision:2,restoreRevision:0,fetcher:async()=>({ok:true,status:200,json:async()=>({version:1,revision:3,layers:{}})})});assert.equal(result.document.revision,3);
});
test('conflict choices preserve a detached local archive and use the reviewed server revision',()=>{
 const local={version:1,revision:2,layers:{object:{base:{x:80}}}},server={version:1,revision:4,layers:{object:{base:{x:120}}}};let archived;
 const mine=prepareConflictResolution({choice:'local',local,server,archive:document=>{archived=document;return true;}});assert.equal(mine.revision,4);assert.equal(mine.layers.object.base.x,80);assert.deepEqual(archived,local);
 mine.layers.object.base.x=100;assert.equal(local.layers.object.base.x,80);assert.equal(archived.layers.object.base.x,80);assert.equal(server.layers.object.base.x,120);
 const theirs=prepareConflictResolution({choice:'server',local,server,archive:()=>true});assert.deepEqual(theirs,server);
 assert.throws(()=>prepareConflictResolution({choice:'server',local,server,archive:()=>false}),/nháp dự phòng/);assert.equal(local.revision,2);assert.equal(local.layers.object.base.x,80);
});
test('latest conflict preview cannot apply after switching scenes and rejects invalid server documents',async()=>{
 const session=new EditSession();session.select('p:a');const pending=deferred();
 const request=loadLatestEdits({session,projectId:'p',scene:'a',fetcher:(_url,options)=>{assert.equal(options.cache,'no-store');assert.ok(options.signal);return pending.promise;}});
 session.select('p:b');pending.resolve({ok:true,json:async()=>({version:1,revision:2,layers:{}})});assert.equal((await request).current,false);
 await assert.rejects(loadLatestEdits({session,projectId:'p',scene:'b',fetcher:async()=>({ok:true,json:async()=>({revision:'new',layers:[]})})}),/không hợp lệ/);
});
test('offline and timed-out saves retain the submitted document and offer a readable retry message',async()=>{
 const session=new EditSession();session.select('p:s');const document={revision:0,layers:{a:{base:{x:10}}}};
 for(const failure of [new TypeError('Failed to fetch'),Object.assign(Error('Request timeout'),{name:'TimeoutError'})]){
  const result=await saveEdits({session,projectId:'p',scene:'s',document,revision:0,fetcher:async(_url,options)=>{assert.ok(options.signal);throw failure;},onSaved:()=>assert.fail('Offline save succeeded'),onError:error=>assert.match(saveFailureMessage(error),/thử lưu lại/)});
  assert.equal(result.ok,false);assert.equal(document.layers.a.base.x,10);
 }
 assert.match(saveFailureMessage(new TypeError('Disconnected'),'read'),/đọc bản mới/);
});
test('malformed conflict responses preserve HTTP 409 for the resolution flow',async()=>{
 const session=new EditSession();session.select('p:s');let status;
 await saveEdits({session,projectId:'p',scene:'s',document:{layers:{}},revision:0,fetcher:async()=>({ok:false,status:409,json:async()=>{throw SyntaxError('Invalid JSON');}}),onSaved:()=>assert.fail(),onError:error=>status=error.status});assert.equal(status,409);
});
test('restore keeps the displayed revision so another window cannot be silently overwritten',async()=>{
 const session=new EditSession();session.select('p:s');let requests=0;
 await assert.rejects(restoreEdits({session,projectId:'p',scene:'s',revision:4,restoreRevision:2,fetcher:async(url,options)=>{
  requests++;assert.equal(url,'/api/projects/p/scenes/s/restore');assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{revision:4,restoreRevision:2});
  return {ok:false,status:409,json:async()=>({error:'Scene changed in another window'})};
 }}),error=>error.status===409);assert.equal(requests,1);
});
test('restore locks edits until failure or success and ignores an obsolete view',async()=>{
 const session=new EditSession();session.select('a');const pending=deferred();
 const restore=session.exclusive(()=>restoreEdits({session,projectId:'p',scene:'a',revision:1,restoreRevision:0,fetcher:()=>pending.promise}));
 assert.equal(session.busy,true);await assert.rejects(session.exclusive(()=>assert.fail('Duplicate operation')),/Chờ/);
 session.select('b');pending.resolve({ok:true,json:async()=>({version:1,revision:2,layers:{}})});
 assert.equal((await restore).current,false);assert.equal(session.busy,false);
 await assert.rejects(session.exclusive(async()=>{throw Error('Disconnected')}),/Disconnected/);assert.equal(session.busy,false);
});
test('a delayed save cannot apply to another scene, including a switch away and back',async()=>{
 const session=new EditSession();session.select('project-a:scene-a');const pending=deferred();let applied=0,body;
 const document={version:1,layers:{'scene-a/shot-0/original':{base:{x:12}}}},saved=saveEdits({session,projectId:'project-a',scene:'scene-a',document,revision:2,fetcher:(_url,options)=>{body=JSON.parse(options.body);return pending.promise;},onSaved:()=>applied++,onError:()=>assert.fail('Unexpected error')});
 document.layers['scene-a/shot-0/original'].base.x=99;session.select('project-b:scene-b');session.select('project-a:scene-a');
 pending.resolve({ok:true,json:async()=>({version:1,revision:3,layers:{'scene-a/shot-0/original':{base:{x:12}}}})});assert.deepEqual(await saved,{ok:true,current:false});assert.equal(applied,0);assert.equal(body.layers['scene-a/shot-0/original'].base.x,12);
});
test('late save failure cannot replace the new scene status; an active conflict keeps its HTTP status',async()=>{
 const session=new EditSession();session.select('a');const pending=deferred();let errors=0;
 const options={session,projectId:'p',scene:'a',document:{layers:{}},revision:0,onSaved:()=>assert.fail('Unexpected save'),onError:error=>{errors++;assert.equal(error.status,409);}};
 const first=saveEdits({...options,fetcher:()=>pending.promise});session.select('b');pending.resolve({ok:false,status:409,json:async()=>({error:'Conflict'})});assert.equal((await first).current,false);assert.equal(errors,0);
 const second=await saveEdits({...options,fetcher:async()=>({ok:false,status:409,json:async()=>({error:'Conflict'})})});assert.equal(second.ok,false);assert.equal(errors,1);
});
test('blocked browser storage does not throw during opening, draft writes or server-save cleanup',()=>{
 const cache=createBrowserCache(()=>{throw Error('SecurityError');});assert.equal(cache.getItem('project'),null);let notice='';const unsubscribe=cache.subscribe(value=>notice=value);assert.ok(notice);assert.equal(cache.setItem('draft','new'),false);assert.equal(cache.removeItem('draft'),false);unsubscribe();
 const quota=createBrowserCache(()=>({getItem:()=>'{"saved":true}',setItem:()=>{throw Error('QuotaExceeded');},removeItem:()=>{throw Error('Denied');}}));assert.equal(quota.getItem('draft'),'{"saved":true}');assert.equal(quota.setItem('draft','new'),false);assert.ok(quota.warning);
});
