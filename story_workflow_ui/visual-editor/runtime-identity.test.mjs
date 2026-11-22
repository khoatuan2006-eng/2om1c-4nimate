import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runtimeIdentity,runtimeVersion,matchingRuntime} from './runtime-identity.mjs';
test('readiness distinguishes data, frontend and editor roots, and verifies the spawned process',async()=>{
 const config={dataDirectory:'fixture-data-a',frontendDirectory:'fixture-ui-a',editorDirectory:'fixture-code-a'},identity=await runtimeIdentity(config);
 for(const field of Object.keys(config))assert.notEqual(await runtimeIdentity({...config,[field]:config[field]+'-other'}),identity);
 const version='a'.repeat(64),health={status:'ready',runtime:'standalone',identity,version,pid:123};assert.equal(matchingRuntime(health,identity,version),true);assert.equal(matchingRuntime(health,identity,version,123),true);assert.equal(matchingRuntime(health,identity,version,456),false);
 assert.equal(matchingRuntime({...health,identity:undefined},identity,version),false);assert.equal(matchingRuntime({...health,status:'stopping'},identity,version),false);assert.equal(matchingRuntime(null,identity,version),false);
 assert.equal(matchingRuntime({...health,version:undefined},identity,version),false);assert.equal(matchingRuntime(health,identity,'b'.repeat(64)),false);assert.equal(matchingRuntime(health,identity),false);
});
test('same-path source, dependency and compiled changes invalidate reuse; project/media/QA changes do not',async t=>{
 const root=await mkdtemp(join(tmpdir(),'doyin-version-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'source'),frontend=join(root,'frontend'),dependency=join(root,'package-lock.json');
 await mkdir(source);await mkdir(frontend);await writeFile(join(source,'server.mjs'),'original');await writeFile(join(frontend,'index.html'),'built');await writeFile(dependency,'lock');
 const config={sourceDirectories:[source],frontendDirectory:frontend,dependencyFiles:[dependency]},original=await runtimeVersion(config);
 for(const name of ['data','evidence','node_modules','test-fixtures','backup']){await mkdir(join(source,name));await writeFile(join(source,name,'ignored.mjs'),"import missing from './missing.json';");}
 await writeFile(join(source,'server.test.mjs'),'test');await writeFile(join(source,'README.md'),'docs');await writeFile(join(source,'.env'),'credential');await writeFile(join(source,'sprite.png'),'media');
 assert.equal(await runtimeVersion(config),original);
 for(const path of [join(source,'server.mjs'),join(frontend,'index.html'),dependency]){
  const before=await runtimeVersion(config);await writeFile(path,'updated');assert.notEqual(await runtimeVersion(config),before);
 }
 const before=await runtimeVersion(config);await writeFile(join(source,'new-worker.mjs'),'worker');assert.notEqual(await runtimeVersion(config),before);
 const withWorker=await runtimeVersion(config);await rm(join(source,'new-worker.mjs'));assert.equal(await runtimeVersion(config),before);assert.notEqual(before,withWorker);
 await writeFile(join(source,'scene.tsx'),"import data from './scene-data.json';");await writeFile(join(source,'scene-data.json'),'{"duration":90}');
 const withScene=await runtimeVersion(config);await writeFile(join(source,'scene-data.json'),'{"duration":120}');assert.notEqual(await runtimeVersion(config),withScene);
 await writeFile(join(source,'utility.mjs'),"const generated = \"import data from './missing.json';\";");await runtimeVersion(config);
});
