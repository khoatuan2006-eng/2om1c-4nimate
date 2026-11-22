import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve,sep} from 'node:path';
import {readLibraryImage} from './prepared-media.mjs';
test('imported catalog reuses manifest version, invalidates on change/removal and preserves hash checks',async()=>{
 const root=await mkdtemp(join(tmpdir(),'doyin-import-cache-'));await mkdir(join(root,'actor'));const image=join(root,'actor/pose.png'),manifest=join(root,'actor/asset.manifest.json'),index=join(root,'editor-index.json');
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');await writeFile(image,bytes);
 const entry={relativePath:'actor',type:'characters'},data={assetId:'one',displayName:'First',source:{path:'fixture.psd'},capabilities:{poses:[{name:'Pose',relativePath:'actor/pose.png'}]}};await writeFile(manifest,JSON.stringify(data));await writeFile(index,JSON.stringify([entry]));process.env.EDITOR_IMPORTS_DIR=root;
 const {importedCatalog,invalidateImportedCatalog}=await import('./discovery-server.mjs?cache-test');
 try{
  let registered=0;const first=await importedCatalog(()=>registered++);assert.equal(first.length,1);assert.equal(registered,1);const originalId=first[0].groups.poses[0].id;
  await rm(image);const cached=await importedCatalog(()=>registered++);assert.equal(cached[0].groups.poses[0].id,originalId);assert.equal(registered,2);
  invalidateImportedCatalog();assert.equal((await importedCatalog(()=>{})).length,0);
  await writeFile(image,bytes);assert.equal((await importedCatalog(()=>{})).length,1);
  data.displayName='A longer changed name';await writeFile(manifest,JSON.stringify(data));assert.equal((await importedCatalog(()=>{}))[0].name,data.displayName);
  await writeFile(image,Buffer.concat([bytes,Buffer.from('changed bytes')]));await assert.rejects(readLibraryImage(image,originalId),/thay đổi/);invalidateImportedCatalog();assert.notEqual((await importedCatalog(()=>{}))[0].groups.poses[0].id,originalId);
  await writeFile(index,'[]');assert.equal((await importedCatalog(()=>{})).length,0);
 }finally{delete process.env.EDITOR_IMPORTS_DIR;assert.ok(resolve(root).startsWith(resolve(tmpdir())+sep));await rm(root,{recursive:true,force:true});}
});
