import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserCache} from './browser-cache.mjs';
import {createDraftStore} from './draft-store.mjs';
function storage(seed=[]){const entries=new Map(seed);return {entries,get length(){return entries.size;},key:index=>[...entries.keys()][index]??null,getItem:key=>entries.get(key)??null,setItem:(key,value)=>entries.set(key,value),removeItem:key=>entries.delete(key)};}
const document=x=>({version:1,revision:2,layers:{'SCENE/shot-0/object':{base:{x}}}});
function fixture(){const shared=storage(),firstSession=storage(),secondSession=storage(),cache=createBrowserCache(()=>shared);let sequence=0;const make=(session,writerId)=>createDraftStore({cache,sessionCache:createBrowserCache(()=>session),writerId,id:()=>String(++sequence),now:()=>new Date(1000+sequence).toISOString()});return {shared,firstSession,secondSession,cache,make,a:make(firstSession,'a'),b:make(secondSession,'b')};}
test('two windows keep different active drafts and saving one never clears the other',()=>{
 const f=fixture();f.a.write('P','SCENE',document(10));f.b.write('P','SCENE',document(80));
 assert.equal(JSON.parse(f.a.read('P','SCENE')).layers['SCENE/shot-0/object'].base.x,10);assert.equal(JSON.parse(f.b.read('P','SCENE')).layers['SCENE/shot-0/object'].base.x,80);
 f.a.clear('P','SCENE');assert.equal(f.a.read('P','SCENE'),null);assert.equal(JSON.parse(f.b.read('P','SCENE')).layers['SCENE/shot-0/object'].base.x,80);
 const records=f.a.list('P','SCENE',30);assert.equal(records.length,1);assert.equal(records[0].document.layers['SCENE/shot-0/object'].base.x,80);
});
test('reload resumes its session draft; duplicated session copies use independent durable writers',()=>{
 const f=fixture();f.a.write('P','SCENE',document(10));const reload=f.make(f.firstSession,'reload');assert.deepEqual(JSON.parse(reload.read('P','SCENE')),document(10));
 const duplicated=storage(f.firstSession.entries),copy=f.make(duplicated,'duplicated');copy.write('P','SCENE',document(90));reload.write('P','SCENE',document(20));
 assert.equal(JSON.parse(copy.read('P','SCENE')).layers['SCENE/shot-0/object'].base.x,90);assert.equal(JSON.parse(reload.read('P','SCENE')).layers['SCENE/shot-0/object'].base.x,20);
 copy.clear('P','SCENE');assert.equal(JSON.parse(reload.read('P','SCENE')).layers['SCENE/shot-0/object'].base.x,20);assert.ok(reload.list('P','SCENE',30).some(entry=>entry.document.layers['SCENE/shot-0/object'].base.x===20));
});
test('archives survive fresh sessions, remain scene scoped, and preserve detached snapshots',()=>{
 const f=fixture(),original=document(42);assert.equal(f.a.archive('P','SCENE',original),true);original.layers['SCENE/shot-0/object'].base.x=500;
 const reopened=f.make(storage(),'new-window'),entries=reopened.list('P','SCENE',30);assert.equal(entries.length,1);assert.equal(entries[0].document.layers['SCENE/shot-0/object'].base.x,42);assert.equal(entries[0].kind,'archive');
 assert.equal(reopened.list('other','SCENE',30).length,0);assert.equal(reopened.list('P','different',30).length,0);
});

test('a lost session leaves its active draft discoverable without silently applying it to a fresh window',()=>{
 const f=fixture();f.a.write('P','SCENE',document(42));
 f.firstSession.entries.clear();
 const fresh=f.make(storage(),'fresh-session');
 assert.equal(fresh.read('P','SCENE'),null);
 const entries=fresh.list('P','SCENE',30);
 assert.equal(entries.length,1);assert.equal(entries[0].kind,'draft');assert.equal(entries[0].own,false);
 assert.deepEqual(entries[0].document,document(42));
 fresh.clear('P','SCENE');
 assert.deepEqual(fresh.list('P','SCENE',30),entries);
 assert.equal(fresh.list('other','SCENE',30).length,0);
});
test('identical archives have one recovery row without deleting storage or merging active windows',()=>{
 const f=fixture();f.a.archive('P','SCENE',document(10));f.b.archive('P','SCENE',document(10));f.a.write('P','SCENE',document(10));f.b.write('P','SCENE',document(10));
 const entries=f.a.list('P','SCENE',30);assert.equal(entries.filter(entry=>entry.kind==='archive').length,1);assert.equal(entries.filter(entry=>entry.kind==='draft').length,2);assert.equal(f.shared.length,4);
});
test('legacy drafts migrate into a window without deleting another window data, and old archives are discoverable',()=>{
 const f=fixture();f.cache.setItem('editor-draft:P:SCENE',JSON.stringify(document(12)));f.cache.setItem('editor-draft:P:SCENE:archived:old',JSON.stringify(document(15)));
 assert.deepEqual(JSON.parse(f.a.read('P','SCENE')),document(12));f.a.clear('P','SCENE');assert.equal(f.a.read('P','SCENE'),null);assert.deepEqual(JSON.parse(f.b.read('P','SCENE')),document(12));assert.ok(f.a.list('P','SCENE',30).some(entry=>entry.document.layers['SCENE/shot-0/object'].base.x===15));
});
test('corrupt and foreign drafts are excluded from apply but remain preserved; storage failures do not throw',()=>{
 const f=fixture();f.cache.setItem('editor-recovery:P:SCENE:archive:bad','broken');f.cache.setItem('editor-recovery:P:SCENE:archive:foreign',JSON.stringify({schemaVersion:1,projectId:'P',scene:'SCENE',kind:'archive',document:{version:1,revision:2,layers:{'OTHER/shot-0/a':{}}}}));assert.deepEqual(f.a.list('P','SCENE',30),[]);assert.equal(f.shared.length,2);
 const blocked=createBrowserCache(()=>{throw Error('Blocked storage');}),store=createDraftStore({cache:blocked,sessionCache:blocked,writerId:'blocked'});assert.deepEqual(store.write('P','SCENE',document(3)),{active:false,durable:false});assert.equal(store.archive('P','SCENE',document(3)),false);assert.equal(store.read('P','SCENE'),null);assert.deepEqual(store.list('P','SCENE',30),[]);assert.ok(blocked.warning);
});
