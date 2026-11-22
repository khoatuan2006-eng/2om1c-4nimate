import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareLibraryImage,readLibraryImage} from './prepared-media.mjs';
import {removeTestFolder} from './test-runtime.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvXcAAAAASUVORK5CYII=','base64'),id=createHash('sha256').update(png).digest('hex');
test('concurrent image preparation publishes complete hash-named bytes, independent of later source edits',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));try{
  const source=join(folder,'source.png'),media=join(folder,'media');await writeFile(source,png);
  const results=await Promise.all(Array.from({length:8},()=>prepareLibraryImage(source,id,media)));assert.ok(results.every(result=>result.src==='library-assets/'+id+'.png'));
  assert.deepEqual(await readFile(join(media,results[0].src)),png);assert.deepEqual(await readdir(join(media,'library-assets')),[id+'.png']);
  await writeFile(source,'changed source');assert.deepEqual(await prepareLibraryImage(source,id,media),results[0]);assert.deepEqual(await readFile(join(media,results[0].src)),png);
  await assert.rejects(readLibraryImage(source,id),error=>error.code==='ASSET_CHANGED');
 }finally{await removeTestFolder(folder);}
});
test('stale source, corrupt prepared copy, missing source and invalid IDs fail without publishing replacement bytes',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));try{
  const source=join(folder,'source.png'),media=join(folder,'media');await writeFile(source,'wrong bytes');await assert.rejects(prepareLibraryImage(source,id,media),/thay đổi/);
  await assert.rejects(readFile(join(media,'library-assets',id+'.png')),error=>error.code==='ENOENT');
  await assert.rejects(prepareLibraryImage(source,'../../escape',media),/Mã ảnh/);await assert.rejects(prepareLibraryImage(join(folder,'missing.png'),id,media),/ảnh nguồn/);
  await writeFile(source,png);const {src}=await prepareLibraryImage(source,id,media);await writeFile(join(media,src),'corrupt');await assert.rejects(prepareLibraryImage(source,id,media),/bị hỏng/);assert.equal(await readFile(join(media,src),'utf8'),'corrupt');
 }finally{await removeTestFolder(folder);}
});
