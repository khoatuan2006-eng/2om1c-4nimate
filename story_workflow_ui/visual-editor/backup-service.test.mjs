import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rename,access,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {ProjectStore,SCHEMA_VERSION} from './project-store.mjs';
import {createBackup,verifyBackup,restoreBackup,listBackups} from './backup-service.mjs';
import {recoverInterruptedRestore} from './restore-journal.mjs';
import {removeTestFolder} from './test-runtime.mjs';
import {readProcessIdentity,readProcessIdentitySync} from './process-identity.mjs';
import {acquireDataLease} from './data-lease.mjs';
async function fixture(){
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-')),data=join(folder,'data');await mkdir(join(data,'media','library-assets'),{recursive:true});
 const bytes=Buffer.from('immutable media'),hash=createHash('sha256').update(bytes).digest('hex'),src='library-assets/'+hash+'.png';await writeFile(join(data,'media',src),bytes);
 const store=new ProjectStore(join(data,'projects.sqlite')),project=store.create('Backup fixture'),id='backup-scene';
 const document={version:1,revision:0,layers:{[id+'/shot-0/object']:{base:{x:12},asset:{name:'image',type:'props',from:0,to:30,left:0,top:0,width:100,height:100,parts:[{src,left:0,top:0,width:100,height:100}]}}}};
 store.addScene(project.id,{id,title:'Backup scene',kind:'created',duration:30,shots:[{from:0,to:30}],cues:[]},document);
 store.saveEdits(id,document,project.id);
 return {folder,data,store,project,id,src,document,async close(){try{store.close();}catch{}await removeTestFolder(folder);}};
}
test('live WAL backup restores edits/history/media; rollback keeps newer original data',async()=>{
 const f=await fixture();try{
  const saved=await createBackup(f.store,f.data);assert.equal((await listBackups(f.data)).length,1);assert.equal((await verifyBackup(saved.folder)).database.integrity,'ok');
  const doc=f.store.getEdits(f.id);doc.layers[f.id+'/shot-0/object'].base.x=99;f.store.saveEdits(f.id,doc);f.store.close();
  const restored=await restoreBackup(saved.folder,f.data),store=new ProjectStore(join(f.data,'projects.sqlite'));
  try{assert.equal(store.getEdits(f.id).layers[f.id+'/shot-0/object'].base.x,12);assert.equal(store.getEdits(f.id).revision,1);assert.equal(store.history(f.id).length,1);}finally{store.close();}
  const original=new DatabaseSync(join(restored.rollback,'projects.sqlite'),{readOnly:true});try{assert.equal(JSON.parse(original.prepare('SELECT document FROM scenes WHERE id=?').get(f.id).document).layers[f.id+'/shot-0/object'].base.x,99);}finally{original.close();}
  assert.equal((await readFile(join(f.data,'media',f.src))).toString(),'immutable media');
 }finally{await f.close();}
});
test('backup includes hashed imported audio and supplemental provenance alongside authored subtitle cues',async()=>{
 const f=await fixture();try{
  const audio=Buffer.from('cached narration'),sha=createHash('sha256').update(audio).digest('hex'),path='audio/'+sha+'.mp3';
  await mkdir(join(f.data,'media/audio'),{recursive:true});await writeFile(join(f.data,'media',path),audio);
  await mkdir(join(f.data,'media/supplemental/records'),{recursive:true});await writeFile(join(f.data,'media/supplemental/records/catalog-test.json'),'fixture metadata');
  f.store.addScene(f.project.id,{id:'cache-scene',title:'Cached audio',kind:'created',duration:30,shots:[{from:0,to:30}],cues:[{publicPath:path}]},{version:1,revision:0,layers:{}});
  f.store.addScene(f.project.id,{id:'authored-subtitles',title:'Authored',kind:'authored',duration:30,shots:[{from:0,to:30}],cues:[{text:'subtitle only',from:0,to:30}]},{version:1,revision:0,layers:{}});
  const saved=await createBackup(f.store,f.data),verified=await verifyBackup(saved.folder);assert.equal(verified.database.integrity,'ok');assert.deepEqual(await readFile(join(saved.folder,'media',path)),audio);assert.equal(await readFile(join(saved.folder,'media/supplemental/records/catalog-test.json'),'utf8'),'fixture metadata');
 }finally{await f.close();}
});

test('a corrupt or incomplete backup cannot replace original data',async()=>{
 const f=await fixture();try{
  const saved=await createBackup(f.store,f.data);f.store.close();await writeFile(join(saved.folder,'media',f.src),'corrupt');
  await assert.rejects(()=>restoreBackup(saved.folder,f.data),/hash|tài nguyên/);
  const original=new DatabaseSync(join(f.data,'projects.sqlite'),{readOnly:true});try{assert.equal(original.prepare('SELECT revision FROM scenes WHERE id=?').get(f.id).revision,1);}finally{original.close();}
 }finally{await f.close();}
});
test('a manifest cannot omit media referenced by a scene even if the remaining hashes are valid',async()=>{
 const f=await fixture();try{const saved=await createBackup(f.store,f.data),path=join(saved.folder,'manifest.json'),manifest=JSON.parse(await readFile(path,'utf8'));manifest.files=manifest.files.filter(file=>file.path!=='media/'+f.src);await writeFile(path,JSON.stringify(manifest));await assert.rejects(()=>verifyBackup(saved.folder),/thiếu tài nguyên đang dùng/);assert.equal(f.store.getEdits(f.id).revision,1);}finally{await f.close();}
});
test('failed second rename rolls back instead of leaving the editor without a database',async()=>{
 const f=await fixture();try{
  const saved=await createBackup(f.store,f.data);f.store.close();let count=0;
  await assert.rejects(()=>restoreBackup(saved.folder,f.data,{renameOperation:async(...args)=>{if(++count===2)throw Object.assign(Error('disk rename failure'),{code:'ENOSPC'});return rename(...args);}}),/disk rename failure/);
  await access(join(f.data,'projects.sqlite'));assert.equal(recoverInterruptedRestore(f.data).status,'none');
 }finally{await f.close();}
});
test('a process crash between directory swaps is recovered before an empty data directory can be created',async()=>{
 const f=await fixture();try{
  f.store.close();const id=randomUUID(),rollback=f.data+'.rollback-'+id,stage=f.data+'.restore-'+id;
  await writeFile(f.data+'.restore-journal.json',JSON.stringify({version:1,id,pid:99999999,target:f.data,rollback,stage}));await rename(f.data,rollback);
  assert.equal(recoverInterruptedRestore(f.data).status,'rolled-back');await access(join(f.data,'projects.sqlite'));
 }finally{await f.close();}
});
test('future database schema is refused without downgrading or changing its version',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-')),file=join(folder,'future.sqlite');
 try{const db=new DatabaseSync(file);db.exec('PRAGMA user_version=999');db.close();assert.throws(()=>new ProjectStore(file),/mới hơn/);const check=new DatabaseSync(file,{readOnly:true});try{assert.equal(check.prepare('PRAGMA user_version').get().user_version,999);}finally{check.close();}assert.equal(SCHEMA_VERSION,1);}finally{await removeTestFolder(folder);}
});

test('restore refuses unsettled or still-live export workers and ignores a proved reused PID',async()=>{
 const f=await fixture();try{
  const saved=await createBackup(f.store,f.data);f.store.close();const id=randomUUID(),folder=join(f.data,'exports',id),workerToken=randomUUID(),identity=await readProcessIdentity(process.pid);assert.equal(identity.state,'alive');await mkdir(folder,{recursive:true});
  const job={id,status:'rendering',workerPid:process.pid,workerToken};await writeFile(join(folder,'job.json'),JSON.stringify(job));await writeFile(join(folder,'worker.json'),JSON.stringify({pid:process.pid,token:workerToken,birth:identity.birth}));
  const before=await readFile(join(f.data,'projects.sqlite'));await assert.rejects(restoreBackup(saved.folder,f.data),/phiên xuất chưa kết thúc/);assert.deepEqual(await readFile(join(f.data,'projects.sqlite')),before);
  await writeFile(join(folder,'job.json'),JSON.stringify({...job,status:'complete'}));await assert.rejects(restoreBackup(saved.folder,f.data),/Worker xuất vẫn sống/);assert.deepEqual(await readFile(join(f.data,'projects.sqlite')),before);
  await writeFile(join(folder,'worker.json'),JSON.stringify({pid:process.pid,token:workerToken}));await assert.rejects(restoreBackup(saved.folder,f.data),/chưa xác minh/);
  await writeFile(join(folder,'worker.json'),JSON.stringify({pid:process.pid,token:workerToken,birth:identity.birth.replace(/\d+$/,ticks=>String(BigInt(ticks)+1n))}));assert.ok((await restoreBackup(saved.folder,f.data)).rollback);assert.doesNotThrow(()=>process.kill(process.pid,0));
 }finally{await f.close();}
});

test('restore journal with a proved different OS generation rolls back before creating a data directory',async()=>{
 const f=await fixture();let release;try{
  f.store.close();const id=randomUUID(),rollback=f.data+'.rollback-'+id,birth=readProcessIdentitySync(process.pid).birth.replace(/\d+$/,ticks=>String(BigInt(ticks)+1n));
  await writeFile(f.data+'.restore-journal.json',JSON.stringify({version:1,id,pid:process.pid,birth,target:f.data,rollback,stage:f.data+'.restore-'+id}));await rename(f.data,rollback);
  release=acquireDataLease(f.data);const db=new DatabaseSync(join(f.data,'projects.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT revision FROM scenes WHERE id=?').get(f.id).revision,1);}finally{db.close();}
  assert.equal(recoverInterruptedRestore(f.data).status,'none');
 }finally{release?.();await f.close();}
});
test('live or uncertain restore journal ownership preserves journal and rollback instead of guessing',async()=>{
 const f=await fixture();try{
  f.store.close();const id=randomUUID(),rollback=f.data+'.rollback-'+id,journal={version:1,id,pid:process.pid,birth:readProcessIdentitySync(process.pid).birth,target:f.data,rollback,stage:f.data+'.restore-'+id};
  await writeFile(f.data+'.restore-journal.json',JSON.stringify(journal));await rename(f.data,rollback);
  assert.throws(()=>acquireDataLease(f.data),/đang phục hồi/);await access(join(rollback,'projects.sqlite'));assert.deepEqual(JSON.parse(await readFile(f.data+'.restore-journal.json','utf8')),journal);
  assert.throws(()=>recoverInterruptedRestore(f.data,{inspectProcess:pid=>({state:'unknown',pid})}),/chưa xác minh/);await access(join(rollback,'projects.sqlite'));
  delete journal.birth;await writeFile(f.data+'.restore-journal.json',JSON.stringify(journal));assert.throws(()=>recoverInterruptedRestore(f.data),/đang phục hồi/);
 }finally{await f.close();}
});
test('restoring through a directory alias swaps the physical data and leaves the alias usable',async()=>{
 const f=await fixture();try{
  const saved=await createBackup(f.store,f.data);f.store.close();const alias=join(f.folder,'data-alias');await symlink(f.data,alias,process.platform==='win32'?'junction':'dir');
  const result=await restoreBackup(saved.folder,alias);assert.equal(result.dataDirectory,f.data);const db=new DatabaseSync(join(alias,'projects.sqlite'),{readOnly:true});try{assert.equal(db.prepare('SELECT revision FROM scenes WHERE id=?').get(f.id).revision,1);}finally{db.close();}await assert.rejects(access(f.data+'.lease'),error=>error.code==='ENOENT');
 }finally{await f.close();}
});
