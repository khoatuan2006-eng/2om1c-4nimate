import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testRuntime} from './test-runtime.mjs';
import {EditSession,saveEdits} from './edit-session.mjs';
test('real SQLite full and readonly errors preserve document/history/draft and permit explicit retry',async()=>{
 const f=await testRuntime();
 try{
  const project=f.store.create('Storage fault fixture'),scene='storage-scene';
  f.store.addScene(project.id,{id:scene,title:'Storage test',kind:'created',duration:90,shots:[{from:0,to:90}],cues:[]},{version:1,revision:0,layers:{}});
  const before=f.store.get(project.id),history=f.store.history(scene,project.id),session=new EditSession();session.select(project.id+':'+scene);
  // Real valid keyframes consume pages; never fill the user's physical volume.
  const document={version:1,revision:0,layers:Object.fromEntries(Array.from({length:150},(_,i)=>[scene+'/shot-0/object-'+i,{base:{x:i},keys:{x:Array.from({length:90},(_,frame)=>({frame,value:frame,easing:'linear'}))}}]))};
  const pages=f.store.db.prepare('PRAGMA page_count').get().page_count;
  f.store.db.exec('PRAGMA max_page_count='+pages);
  // Confirm the native error survives SQLite's automatic transaction rollback.
  assert.throws(()=>f.store.saveEdits(scene,document,project.id),error=>error.code==='ERR_SQLITE_ERROR'&&(error.errcode&255)===13);
  let draft=structuredClone(document),failure,acknowledged=0;
  const options={session,projectId:project.id,scene,duration:90,document,revision:0,fetcher:(url,request)=>fetch(f.base+url,{...request,headers:{...request.headers,Origin:f.base}}),onSaved:()=>{acknowledged++;draft=null;},onError:error=>failure=error};
  const full=await saveEdits(options);assert.equal(full.ok,false);assert.equal(failure.status,507);assert.equal(failure.code,'STORAGE_FULL');
  assert.equal(acknowledged,0);assert.deepEqual(draft,document);assert.deepEqual(f.store.get(project.id),before);assert.deepEqual(f.store.history(scene,project.id),history);
  f.store.db.exec('PRAGMA max_page_count=1073741823; PRAGMA query_only=ON');
  const readonly=await saveEdits(options);assert.equal(readonly.ok,false);assert.equal(failure.status,503);assert.equal(failure.code,'STORAGE_READONLY');
  assert.equal(acknowledged,0);assert.deepEqual(draft,document);assert.deepEqual(f.store.get(project.id),before);assert.deepEqual(f.store.history(scene,project.id),history);
  f.store.db.exec('PRAGMA query_only=OFF');
  const retry=await saveEdits(options);assert.equal(retry.ok,true);assert.equal(acknowledged,1);assert.equal(draft,null);
  assert.equal(f.store.getEdits(scene,project.id).revision,1);assert.deepEqual(f.store.getEdits(scene,project.id).layers,document.layers);
  assert.equal(f.store.history(scene,project.id).length,1);assert.equal(f.store.db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 }finally{await f.close();}
});
