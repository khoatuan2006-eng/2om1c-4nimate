import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ProjectStore} from './project-store.mjs';
const blank=()=>({version:1,revision:0,layers:{}});
const source=(id,duration)=>({id,title:id,kind:'created',duration,shots:[{from:0,to:duration}],cues:[]});
test('deletion checks revision and protection, removes histories, and preserves other projects',()=>{
 const s=new ProjectStore(':memory:');try{
  const a=s.create('Delete'),b=s.create('Keep');s.addScene(a.id,source('delete-one',30),blank());s.saveEdits('delete-one',blank(),a.id);
  assert.throws(()=>s.delete(a.id,{revision:0}),{code:'REVISION_CONFLICT'});
  const revision=s.get(a.id).revision;
  s.db.prepare('UPDATE projects SET locked_prefix=? WHERE id=?').run('["delete-one"]',a.id);
  assert.throws(()=>s.delete(a.id,{revision}),{code:'PROJECT_PROTECTED'});
  s.db.prepare('UPDATE projects SET locked_prefix=? WHERE id=?').run('[]',a.id);
  assert.equal(s.delete(a.id,{revision}).sceneCount,1);assert.throws(()=>s.get(a.id));assert.equal(s.get(b.id).title,'Keep');
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM edit_history').get().n,0);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM project_history').get().n,0);
  s.create('Original','nhat-thanh-ep01');assert.equal(s.delete('nhat-thanh-ep01',{revision:0}).deleted,true,'the legacy episode is an ordinary project once approved scenes are not locked');
 }finally{s.close();}
});
test('projects are isolated and total film timing is recomputed after reorder',()=>{
  const s=new ProjectStore(':memory:');try{
    const a=s.create('A'),b=s.create('B');s.addScene(a.id,source('one',60),blank());s.addScene(a.id,source('two',90),blank());s.addScene(b.id,source('three',30),blank());
    let p=s.get(a.id);assert.equal(p.duration,150);assert.deepEqual(p.scenes.map(c=>[c.id,c.from,c.to]),[['one',0,60],['two',60,150]]);
    p=s.update(a.id,{revision:p.revision,sceneOrder:['two','one']});assert.deepEqual(p.scenes.map(c=>[c.id,c.from,c.to]),[['two',0,90],['one',90,150]]);
    assert.deepEqual(s.get(b.id).sceneOrder,['three']);assert.throws(()=>s.getEdits('one',b.id));
    assert.throws(()=>s.update(a.id,{revision:p.revision,sceneOrder:['one','three']}));assert.throws(()=>s.update(a.id,{revision:p.revision-1,sceneOrder:['one','two']}));
  }finally{s.close();}
});
test('scene addition is atomic/idempotent and protected prefix cannot move or be edited',()=>{
  const s=new ProjectStore(':memory:');try{
    const p=s.create('A');s.addScene(p.id,source('one',30),blank());s.addScene(p.id,source('two',30),blank());
    const before=s.get(p.id);s.addScene(p.id,source('one',999),blank());assert.deepEqual(s.get(p.id),before);
    assert.throws(()=>s.addScene(p.id,source('bad',30),{version:1,revision:0,layers:{'bad/shot-0/x':{base:{scale:0}}}}));assert.deepEqual(s.get(p.id),before);
    s.db.prepare('UPDATE projects SET locked_prefix=? WHERE id=?').run('["one"]',p.id);
    assert.throws(()=>s.update(p.id,{revision:before.revision,sceneOrder:['two','one']}));assert.throws(()=>s.saveEdits('one',blank(),p.id));
  }finally{s.close();}
});
test('saving/restoring preserves source timing, increments revisions, and rejects conflicts and foreign layers',()=>{
  const s=new ProjectStore(':memory:');try{
    const p=s.create('A');s.addScene(p.id,source('one',90),blank());
    const document={...blank(),layers:{'one/shot-0/object':{keys:{x:[{frame:0,value:0,easing:"linear"},{frame:60,value:100,easing:"linear"}]}}}};
    const saved=s.saveEdits('one',document,p.id);assert.equal(saved.revision,1);assert.equal(s.history('one',p.id).length,1);
    assert.throws(()=>s.saveEdits('one',document,p.id));assert.throws(()=>s.saveEdits('one',{...saved,layers:{'two/shot-0/obj':{base:{x:3}}}},p.id));
    const restored=s.restore('one',{revision:1,restoreRevision:0},p.id);assert.equal(restored.revision,2);assert.deepEqual(restored.layers,{});assert.equal(s.get(p.id).duration,90);assert.deepEqual(s.get(p.id).scenes[0].cues,[]);
  }finally{s.close();}
});

test('archived projects can be deleted and their workflow metadata is removed',()=>{
  const s=new ProjectStore(':memory:'),p=s.create('Old QA');
  s.db.prepare('UPDATE projects SET archived=1 WHERE id=?').run(p.id);s.db.prepare("INSERT INTO meta VALUES(?,?)").run('project-mode:'+p.id,'draft');
  assert.throws(()=>s.get(p.id),/Không tìm thấy/);
  assert.equal(s.delete(p.id,{revision:0}).deleted,true);
  assert.equal(s.db.prepare('SELECT COUNT(*) n FROM projects').get().n,0);assert.equal(s.db.prepare("SELECT COUNT(*) n FROM meta WHERE key LIKE 'project-mode:%'").get().n,0);
  assert.throws(()=>s.delete(p.id,{revision:0}),/Không tìm thấy/);s.close();
});
