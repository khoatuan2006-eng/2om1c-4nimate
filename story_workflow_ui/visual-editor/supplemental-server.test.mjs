import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {testRuntime} from './test-runtime.mjs';
import {digest} from './supplemental-catalog.mjs';
const pngBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=';
test('HTTP upload reuses supplemental registry and media pipeline, preserves provenance, is replay/version safe, and rejects server-path authority',async()=>{
 const f=await testRuntime();
 try{
  const p=f.store.create('Upload fixture','p'),path='/api/supplements/'+p.id,bytes=Buffer.from('Tool receipt and reuse search: synthetic test only'),hash=digest(bytes);
  const input={pngBase64,attachments:[{sha256:hash,base64:bytes.toString('base64')}],record:{version:1,name:'Tài nguyên kiểm thử',type:'props',purpose:'Isolated upload test',tags:['fixture'],capabilities:['static'],limitations:['Synthetic 1px fixture'],provenance:{kind:'generated',tool:'isolated-test-fixture',prompt:{text:'Synthetic fixture; not production art'},documents:[{path:'upload:'+hash,sha256:hash}]},review:{status:'candidate'}}};
  assert.equal((await f.request(path,input,'POST','http://evil.example')).status,403);
  const post=await f.request(path,input);assert.equal(post.status,201);const record=await post.json();assert.equal(record.revision,1);assert.equal(record.projectId,p.id);assert.equal(record.image.sha256,digest(Buffer.from(pngBase64,'base64')));
  assert.deepEqual(await readFile(record.provenance.documents[0].path),bytes);
  assert.equal((await (await f.request(path,input)).json()).revision,1);
  f.store.create('Other project','other');assert.equal((await f.request('/api/supplements/other',input)).status,409);
  const catalog=await (await fetch(f.base+'/api/library/catalog')).json(),asset=catalog.find(a=>a.id===record.id);assert.equal(asset.review.status,'candidate');assert(asset.name.includes('Chưa duyệt'));
  const prepared=await f.request('/api/library/prepare?id='+record.image.sha256,{});assert.equal(prepared.status,200);assert.equal((await prepared.json()).src,record.image.src);
  const image=await fetch(f.base+asset.groups.props[0].url);assert.deepEqual(Buffer.from(await image.arrayBuffer()),Buffer.from(pngBase64,'base64'));
  const changed=structuredClone(input);changed.record.expectedRevision=1;changed.record.name='Tên đã sửa';assert.equal((await (await f.request(path,changed)).json()).revision,2);changed.record.name='Tên cũ xung đột';assert.equal((await f.request(path,changed)).status,409);
  for(const alter of [r=>r.record.sourceFile='C:/private.png',r=>r.record.projectId='other',r=>r.record.review.status='reviewed',r=>r.record.provenance.documents[0].path='C:/private.txt',r=>r.attachments[0].sha256='a'.repeat(64)]){const bad=structuredClone(input);alter(bad);assert.equal((await f.request(path,bad)).status,400);}
  assert.equal(f.store.get('p').scenes.length,0);
 }finally{await f.close();}
});
