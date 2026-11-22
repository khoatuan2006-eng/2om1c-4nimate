import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fork,spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {readProcessIdentity} from './process-identity.mjs';
const windows=process.platform==='win32';
async function tree(){
 const worker=fork(new URL('./test-fixtures/contained-tree.mjs',import.meta.url),[],{detached:true,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
 let logs='';worker.stderr.on('data',chunk=>logs+=chunk);worker.stdout.on('data',chunk=>logs+=chunk);
 try{
  const ready=await new Promise((ok,fail)=>{
   const timer=setTimeout(()=>fail(Error('Containment fixture timed out: '+logs)),15000);
   worker.once('message',message=>{clearTimeout(timer);ok(message);});worker.once('exit',code=>{clearTimeout(timer);fail(Error('Fixture exited '+code+': '+logs));});
  });
  assert.equal(ready.kind,'windows-job-object');
  const records=await Promise.all([ready.workerPid,ready.guardianPid,ready.branchPid,ready.leafPid].map(readProcessIdentity));
  for(const record of records){assert.equal(record.state,'alive');assert.ok(record.birth);}
  return {worker,records};
 }catch(error){worker.kill();throw error;}
}
async function gone(records){
 const deadline=Date.now()+10000;
 for(const record of records)for(;;){
  const current=await readProcessIdentity(record.pid);
  if(current.state==='gone'||current.state==='alive'&&current.birth!==record.birth)break;
  assert.ok(Date.now()<deadline,'Contained generation still alive: '+record.pid);await delay(30);
 }
}
for(const mode of ['normal exit','abrupt worker death','guardian death'])test('Windows job containment removes descendants after '+mode,{skip:!windows,timeout:30000},async()=>{
 const {worker,records}=await tree();
 try{
  const exited=once(worker,'exit');
  if(mode==='normal exit')worker.send('exit');else if(mode==='abrupt worker death')worker.kill();else worker.send('lose-guardian');
  await exited;await gone(records);
 }finally{if(worker.exitCode===null&&worker.signalCode===null)worker.kill();}
});
test('guardian refuses a changed worker generation without terminating the referenced process',{skip:!windows,timeout:15000},async()=>{
 const worker=fork(new URL('./test-fixtures/contained-tree.mjs',import.meta.url),['leaf'],{windowsHide:true,stdio:'ignore'});
 try{
  await once(worker,'spawn');const identity=await readProcessIdentity(worker.pid);assert.equal(identity.state,'alive');assert.ok(identity.birth);
  const wrongBirth='windows:'+(BigInt(identity.birth.slice(8))+10n);
  const guard=spawn(resolve(process.env.SystemRoot??'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve(import.meta.dirname,'render-containment.ps1'),'-WorkerId',String(worker.pid),'-WorkerBirth',wrongBirth],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let error='';guard.stderr.on('data',chunk=>error+=chunk);const [code]=await once(guard,'exit');assert.notEqual(code,0);assert.match(error,/generation changed/);
  assert.equal((await readProcessIdentity(worker.pid)).birth,identity.birth);assert.equal(worker.exitCode,null);
 }finally{if(worker.exitCode===null&&worker.signalCode===null){const exited=once(worker,'exit');worker.kill();await exited;}}
});
