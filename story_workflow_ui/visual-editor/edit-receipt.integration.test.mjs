import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testRuntime} from './test-runtime.mjs';
import {EditSession,saveEdits,loadLatestEdits,restoreEdits,prepareConflictResolution,isRevisionConflict,isSceneLockedError} from './edit-session.mjs';

test('lost save receipt retains draft, real retry conflicts, reviewed revision recovers and history restores',async()=>{
 const f=await testRuntime();
 try{
  const project=f.store.create('Receipt fault fixture'),scene='receipt-scene';
  f.store.addScene(project.id,{id:scene,title:'Receipt test',kind:'created',duration:90,shots:[{from:0,to:90}],cues:[]},{version:1,revision:0,layers:{}});
  const session=new EditSession();session.select(project.id+':'+scene);
  const document={version:1,revision:0,layers:{[scene+'/shot-0/object']:{base:{x:120,y:70},keys:{x:[{frame:0,value:120,easing:'linear'},{frame:89,value:200,easing:'linear'}]}}}};
  const fetcher=(url,options)=>fetch(f.base+url,{...options,headers:{...options?.headers,Origin:f.base}});
  const options={session,projectId:project.id,scene,duration:90,document,revision:0};
  let acknowledged=0,failed,heldDraft=structuredClone(document);
  // The actual PUT commits, but an intermediary loses/replaces its receipt.
  const lost=await saveEdits({...options,fetcher:async(url,request)=>{
   const response=await fetcher(url,request);assert.equal(response.status,200);
   const committed=await response.json();assert.equal(committed.revision,1);
   return new Response('<html>Interrupted response</html>',{status:200});
  },onSaved:()=>{acknowledged++;heldDraft=null;},onError:error=>failed=error});
  assert.equal(lost.ok,false);assert.equal(failed.code,'INVALID_RESPONSE');assert.equal(acknowledged,0);assert.deepEqual(heldDraft,document);
  const retry=await saveEdits({...options,fetcher,onSaved:()=>assert.fail('Stale retry overwrote server'),onError:error=>failed=error});
  assert.equal(retry.ok,false);assert.equal(failed.status,409);assert.equal(failed.code,'REVISION_CONFLICT');assert.equal(isRevisionConflict(failed),true);assert.deepEqual(heldDraft,document);
  const latest=await loadLatestEdits({...options,fetcher});assert.equal(latest.document.revision,1);assert.deepEqual(latest.document.layers,document.layers);
  // Newer local edits must survive reading the server receipt.
  document.layers[scene+'/shot-0/object'].base.y=95;
  let archive;
  const reviewed=prepareConflictResolution({choice:'local',local:document,server:latest.document,archive:value=>{archive=value;return true;}});
  const recovered=await saveEdits({...options,document:reviewed,revision:reviewed.revision,fetcher,onSaved:saved=>{acknowledged++;heldDraft=null;assert.equal(saved.revision,2);assert.equal(saved.layers[scene+'/shot-0/object'].base.y,95);},onError:()=>assert.fail('Reviewed save failed')});
  assert.equal(recovered.ok,true);assert.equal(acknowledged,1);assert.equal(heldDraft,null);assert.equal(archive.layers[scene+'/shot-0/object'].base.y,95);
  const restored=await restoreEdits({...options,revision:2,restoreRevision:1,fetcher});assert.equal(restored.document.revision,3);assert.equal(restored.document.layers[scene+'/shot-0/object'].base.y,70);
  await assert.rejects(loadLatestEdits({...options,duration:89,fetcher}),error=>error.code==='INVALID_RESPONSE');
  const final=await loadLatestEdits({...options,fetcher});assert.equal(final.document.revision,3);assert.equal(final.document.layers[scene+'/shot-0/object'].base.y,70);
  // A lock acquired after the client loaded must stop saves and history restore,
  // with a different actionable error from a revision conflict.
  f.store.db.prepare('UPDATE projects SET locked_prefix=? WHERE id=?').run(JSON.stringify([scene]),project.id);
  const history=f.store.history(scene,project.id),before=f.store.get(project.id);
  heldDraft=structuredClone(document);
  const locked=await saveEdits({...options,revision:3,fetcher,onSaved:()=>assert.fail('Locked save cleared draft'),onError:error=>failed=error});
  assert.equal(locked.ok,false);assert.equal(failed.status,409);assert.equal(failed.code,'SCENE_LOCKED');assert.equal(isSceneLockedError(failed),true);assert.equal(isRevisionConflict(failed),false);assert.deepEqual(heldDraft,document);
  await assert.rejects(restoreEdits({...options,revision:3,restoreRevision:1,fetcher}),error=>error.status===409&&error.code==='SCENE_LOCKED'&&!isRevisionConflict(error));
  assert.deepEqual(f.store.get(project.id),before);assert.deepEqual(f.store.history(scene,project.id),history);
 }finally{await f.close();}
});
