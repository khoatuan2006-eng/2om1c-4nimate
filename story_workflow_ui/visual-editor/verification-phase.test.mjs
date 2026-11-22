import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verificationPhase} from './test-fixtures/verification-phase.mjs';
import {removeTestFolder} from './test-runtime.mjs';

async function fixture(run){
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));
 const receipt=join(folder,'phase.json'),entry={name:'fault fixture',status:'running',log:join(folder,'phase.log')};
 const record=()=>writeFile(receipt,JSON.stringify(entry));
 try{await record();await run({folder,entry,record,receipt});}finally{await removeTestFolder(folder);}
}

test('verification records a terminal failure when the executable cannot start',async()=>fixture(async f=>{
 await assert.rejects(verificationPhase({...f,cwd:f.folder,executable:join(f.folder,'missing-executable.exe'),args:[]}));
 const saved=JSON.parse(await readFile(f.receipt,'utf8'));
 assert.equal(saved.status,'fail');assert.equal(saved.errorCode,'ENOENT');assert.notEqual(saved.code,0);assert.ok(saved.finishedAt);
}));

test('failed verification preserves all output before recording the exit code',async()=>fixture(async f=>{
 const script=join(f.folder,'output.mjs');
 await writeFile(script,"process.stdout.write('x'.repeat(1024*1024),()=>process.stderr.write('FINAL FAILURE\\n',()=>{process.exitCode=7;}));");
 await assert.rejects(verificationPhase({...f,cwd:f.folder,args:[script]}),/failed; inspect/);
 const log=await readFile(f.entry.log,'utf8'),saved=JSON.parse(await readFile(f.receipt,'utf8'));
 assert.equal(log.replace('FINAL FAILURE\n',''),'x'.repeat(1024*1024));assert.equal(saved.code,7);assert.equal(saved.status,'fail');assert.ok(saved.finishedAt);
}));

test('an unavailable log becomes a recorded phase failure before spawning work',async()=>fixture(async f=>{
 f.entry.log=join(f.folder,'missing-directory','phase.log');
 await assert.rejects(verificationPhase({...f,cwd:f.folder,args:['-e',"throw Error('must never run')"]}));
 const saved=JSON.parse(await readFile(f.receipt,'utf8'));
 assert.equal(saved.status,'fail');assert.equal(saved.errorCode,'ENOENT');assert.equal(saved.code,null);assert.ok(saved.finishedAt);
}));

test('an abruptly terminated phase is failed rather than left running',async()=>fixture(async f=>{
 await assert.rejects(verificationPhase({...f,cwd:f.folder,args:['-e','process.kill(process.pid)']}),/failed; inspect/);
 const saved=JSON.parse(await readFile(f.receipt,'utf8'));
 assert.equal(saved.status,'fail');assert.notEqual(saved.code,0);assert.ok(saved.finishedAt);
}));
