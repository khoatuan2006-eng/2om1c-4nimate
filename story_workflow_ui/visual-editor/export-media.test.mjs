import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {freezeExportMedia,verifyExportMedia} from './export-media.mjs';
import {removeTestFolder} from './test-runtime.mjs';
test('authored subtitle cues do not masquerade as generated audio during export',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));try{
  const root=join(folder,'media'),target=join(folder,'export');
  await mkdir(join(root,'images'),{recursive:true});await mkdir(join(root,'audio'),{recursive:true});
  await writeFile(join(root,'audio/s08-mai.mp3'),'native speech');
  const scene={kind:'authored',cues:[{from:0,to:77,text:'Nhật Thành',speaker:null}]};
  const records=await freezeExportMedia({scenes:[scene]},root,target);
  assert.deepEqual(records.map(r=>r.path),['audio/s08-mai.mp3']);await verifyExportMedia(target,records);
  scene.cues[0].publicPath='/../../secret.mp3';await assert.rejects(freezeExportMedia({scenes:[scene]},root,target),/Audio.*không hợp lệ/);
  await assert.rejects(freezeExportMedia({scenes:[{...scene,kind:'created',cues:[{text:'missing speech'}]}]},root,target),/Audio.*không hợp lệ/);
 }finally{await removeTestFolder(folder);}
});
test('export captures referenced image/audio bytes; later source changes cannot alter that export',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));try{
  const root=join(folder,'media'),target=join(folder,'export'),image=Buffer.from('fixture image'),audio=Buffer.from('fixture audio'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const path='library-assets/'+hash(image)+'.png',sound='generated/audio/tts-fixture.mp3';await mkdir(join(root,'library-assets'),{recursive:true});await mkdir(join(root,'generated/audio'),{recursive:true});await writeFile(join(root,path),image);await writeFile(join(root,sound),audio);
  const project={scenes:[{kind:'created',document:{layers:{object:{asset:{parts:[{src:path}]}}}},cues:[{publicPath:'/'+sound+'?v=cache',contentHash:'sha256:'+hash(audio)}]}]};
  const records=await freezeExportMedia(project,root,target);assert.equal(records.length,2);await verifyExportMedia(target,records);
  await writeFile(join(root,path),'new source');await writeFile(join(root,sound),'new audio');await verifyExportMedia(target,records);assert.deepEqual(await readFile(join(target,sound)),audio);
  await writeFile(join(target,sound),'corrupted export');await assert.rejects(verifyExportMedia(target,records),/đã thay đổi/);
 }finally{await removeTestFolder(folder);}
});
test('imported hash-named audio freezes and refuses changed bytes before rendering',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));try{
  const root=join(folder,'media'),target=join(folder,'export'),audio=Buffer.from('cached Mai'),sha=createHash('sha256').update(audio).digest('hex'),path='audio/'+sha+'.mp3';await mkdir(join(root,'audio'),{recursive:true});await writeFile(join(root,path),audio);
  const project={scenes:[{kind:'created',cues:[{publicPath:path}]}]},records=await freezeExportMedia(project,root,target);assert.equal(records[0].sha256,sha);await verifyExportMedia(target,records);
  await writeFile(join(root,path),'changed');await assert.rejects(freezeExportMedia(project,root,target),/thay đổi/);
 }finally{await removeTestFolder(folder);}
});

test('preflight refuses missing audio, stale content hashes and escaping media paths before a renderer runs',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));try{
  const root=join(folder,'media'),target=join(folder,'export');await mkdir(join(root,'generated/audio'),{recursive:true});
  const project={scenes:[{cues:[{publicPath:'/generated/audio/tts-fixture.mp3',contentHash:'sha256:'+'a'.repeat(64)}]}]};
  await assert.rejects(freezeExportMedia(project,root,target),/Thiếu tài nguyên/);await writeFile(join(root,'generated/audio/tts-fixture.mp3'),'changed');await assert.rejects(freezeExportMedia(project,root,target),/bị hỏng/);
  project.scenes[0].cues[0].publicPath='/../../secret.mp3';await assert.rejects(freezeExportMedia(project,root,target),/Audio.*không hợp lệ/);
 }finally{await removeTestFolder(folder);}
});

test('audioTracks (bgm and sfx) freeze and verify content hashes alongside voice cues',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));try{
  const root=join(folder,'media'),target=join(folder,'export'),bgm=Buffer.from('bgm bytes'),sha=createHash('sha256').update(bgm).digest('hex'),path='audio/'+sha+'.mp3';
  await mkdir(join(root,'audio'),{recursive:true});await writeFile(join(root,path),bgm);
  const project={scenes:[{kind:'created',cues:[],audioTracks:[{id:'bgm-1',role:'bgm',from:0,to:90,publicPath:path,contentHash:'sha256:'+sha}]}]};
  const records=await freezeExportMedia(project,root,target);
  assert.deepEqual(records.map(r=>r.path),[path]);
  await verifyExportMedia(target,records);
  await writeFile(join(root,path),'tampered bgm');
  await assert.rejects(freezeExportMedia(project,root,target),/thay đổi/);
 }finally{await removeTestFolder(folder);}
});
