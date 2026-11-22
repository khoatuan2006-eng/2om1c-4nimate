import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resolveDraft,readResume} from './draft-model.mjs';
const server={version:1,revision:3,layers:{}};
test('a locked scene opens server content without applying or discarding its valid local draft',()=>{
 for(const revision of [2,3]){
  const draft={version:1,revision,layers:{'a/shot-0/object':{base:{x:245}}}},raw=JSON.stringify(draft);
  const result=resolveDraft(server,raw,90,'a',true);assert.equal(result.status,'locked');assert.deepEqual(result.document,server);assert.deepEqual(result.draft,draft);assert.equal(JSON.stringify(draft),raw);
 }
 assert.equal(resolveDraft(server,'{',90,'a',true).status,'invalid');
});
test('recover same-revision local edits and keep newer server state on conflict',()=>{
 const draft={...server,layers:{'a/shot-0/object':{base:{x:120}}}};
 assert.deepEqual(resolveDraft(server,JSON.stringify(draft),90,'a').document,draft);
 const old={...draft,revision:2},result=resolveDraft(server,JSON.stringify(old),90,'a');assert.equal(result.status,'conflict');assert.deepEqual(result.document,server);assert.deepEqual(result.draft,old);
});
test('invalid or foreign drafts and malformed resume state cannot prevent opening a project',()=>{
 const foreign={...server,layers:{'b/shot-0/object':{base:{x:1}}}};
 const invalid={...server,layers:{'a/shot-0/object':{base:{scale:0}}}};
 for(const raw of ['{',JSON.stringify(foreign),JSON.stringify(invalid)])assert.equal(resolveDraft(server,raw,90,'a').status,'invalid');
 assert.deepEqual(readResume('{'),{scene:'',frame:0});assert.deepEqual(readResume('{"frame":-2,"scene":"a"}'),{scene:'a',frame:0});
});
