import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {renameWithRetry} from './atomic-write.mjs';
import {removeTestFolder} from './test-runtime.mjs';
test('a transient rename lock leaves original bytes intact and retries the same staged bytes',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-')),from=join(folder,'stage'),to=join(folder,'current');try{
  await writeFile(from,'new');await writeFile(to,'old');let calls=0;
  await renameWithRetry(from,to,{operation:async(a,b)=>{if(++calls===1){assert.equal(await readFile(to,'utf8'),'old');throw Object.assign(Error('Windows transient lock'),{code:'EPERM'});}return rename(a,b);}});
  assert.equal(await readFile(to,'utf8'),'new');assert.equal(calls,2);
  await writeFile(from,'another');await assert.rejects(renameWithRetry(from,to,{operation:async()=>{throw Object.assign(Error('disk error'),{code:'ENOSPC'});}}),/disk error/);assert.equal(await readFile(to,'utf8'),'new');assert.equal(await readFile(from,'utf8'),'another');
 }finally{await removeTestFolder(folder);}
});
