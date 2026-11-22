import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSceneDraftStore} from './create-scene-drafts.mjs';
const memory=()=>{const data=new Map();return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);return true;},keys:p=>[...data.keys()].filter(k=>k.startsWith(p))};};
let counter=0;const id=()=>`00000000-0000-4000-8000-${String(++counter).padStart(12,'0')}`;
const fresh=()=>({id:id(),title:'',text:'',voiceId:'mai',backgroundId:'',step:0});
const store=(cache,sessionCache,writerId=id())=>createSceneDraftStore({cache,sessionCache,writerId,id});
test('two windows keep independent scene drafts across writes, reload and a completed reset',()=>{
 const cache=memory(),aSession=memory(),bSession=memory(),a=store(cache,aSession),b=store(cache,bSession);
 const first={...fresh(),title:'A',text:'First'},second={...fresh(),title:'B',text:'Second'};a.write('p',first);b.write('p',second);
 assert.equal(a.read('p',fresh).text,'First');assert.equal(b.read('p',fresh).text,'Second');
 assert.equal(store(cache,aSession).read('p',fresh).text,'First');b.write('p',fresh());assert.equal(a.read('p',fresh).text,'First');assert.ok(a.list('p').some(e=>e.draft.text==='First'));
});
test('copied sessions fork unsubmitted IDs but keep the same submitted job for safe resume',()=>{
 const cache=memory(),session=memory(),a=store(cache,session),unsubmitted={...fresh(),text:'First'};a.write('p',unsubmitted);
 const copy=memory();for(const [k,v] of session.data)copy.data.set(k,v);const b=store(cache,copy),fork=b.read('p',fresh);assert.notEqual(fork.id,unsubmitted.id);b.write('p',fork);
 assert.equal(cache.keys('create-draft-recovery:p:').length,2);assert.equal(a.list('p').length,1);
 const submitted={...unsubmitted,started:true,step:1};a.write('p',submitted);for(const [k,v] of session.data)copy.data.set(k,v);assert.equal(b.read('p',fresh).id,submitted.id);
});
test('legacy scene drafts migrate without overwriting the shared original or another project',()=>{
 const cache=memory(),a=store(cache,memory()),legacy={...fresh(),text:'Legacy',started:true,step:1};cache.setItem('nhat-thanh-create-scene-v1:p',JSON.stringify(legacy));
 assert.deepEqual(a.read('p',fresh),legacy);a.write('p',{...legacy,title:'New'});assert.equal(JSON.parse(cache.getItem('nhat-thanh-create-scene-v1:p')).title,'');assert.equal(a.read('other',fresh).text,'');
});
test('recovering another draft first preserves current content and refuses replacement when archive fails',()=>{
 const cache=memory(),a=store(cache,memory()),current={...fresh(),text:'Current'},other={...fresh(),text:'Other'};a.write('p',other);
 const entry=a.list('p')[0],next=a.adopt('p',current,entry);assert.equal(next.text,'Other');assert.notEqual(next.id,other.id);assert.ok(a.list('p').some(e=>e.kind==='archive'&&e.draft.text==='Current'));
 const blocked=store({...cache,setItem:()=>false},memory());assert.throws(()=>blocked.adopt('p',current,entry),/Nội dung hiện tại được giữ nguyên/);assert.equal(current.text,'Current');assert.throws(()=>a.adopt('other',current,entry),/không thuộc/);
});
test('corrupt recovery entries remain stored but cannot be applied or prevent opening',()=>{
 const cache=memory(),session=memory(),a=store(cache,session);session.setItem('create-window-draft:p','{');cache.setItem('create-draft-recovery:p:bad','{');
 assert.equal(a.read('p',fresh).text,'');assert.deepEqual(a.list('p'),[]);assert.equal(cache.getItem('create-draft-recovery:p:bad'),'{');
});
test('duplicate display rows collapse without deleting records or merging different submitted jobs',()=>{
 const cache=memory(),a=store(cache,memory()),b=store(cache,memory()),draft={...fresh(),text:'Same'};
 a.write('p',draft);b.write('p',{...draft,id:id()});a.archive('p',draft);assert.equal(a.list('p').length,1);assert.equal(cache.keys('create-draft-recovery:p:').length,3);
 a.write('p',{...draft,started:true});b.write('p',{...draft,id:id(),started:true});assert.equal(a.list('p').filter(e=>e.draft.started).length,2);assert.equal(cache.keys('create-draft-recovery:p:').length,3);
});
