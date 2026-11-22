import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,access,symlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {acquireDataLease} from './data-lease.mjs';
import {readProcessIdentitySync} from './process-identity.mjs';
import {removeTestFolder} from './test-runtime.mjs';
const json=file=>readFile(file,'utf8').then(JSON.parse);
async function fixture(){const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));return {folder,root:join(folder,'data'),close:()=>removeTestFolder(folder)};}
const staleOwner=()=>({pid:process.pid,token:randomUUID(),birth:readProcessIdentitySync(process.pid).birth.replace(/\d+$/,ticks=>String(BigInt(ticks)+1n)),startedAt:new Date().toISOString()});
async function seed(root,owner,{packet=true}={}){await mkdir(root,{recursive:true});await writeFile(join(root,'runtime.lock'),JSON.stringify(owner));if(packet){await mkdir(root+'.lease');await writeFile(join(root+'.lease','owner.json'),JSON.stringify(owner));}}
test('live owner is exclusive; release removes both metadata and canonical packet and is idempotent',async()=>{
 const f=await fixture();let release;try{release=acquireDataLease(f.root);const before=await json(join(f.root,'runtime.lock'));assert.equal(before.birth,readProcessIdentitySync(process.pid).birth);assert.throws(()=>acquireDataLease(f.root),/phiên khác/);assert.deepEqual(await json(join(f.root,'runtime.lock')),before);release();release();await assert.rejects(access(f.root+'.lease'),error=>error.code==='ENOENT');await assert.rejects(access(join(f.root,'runtime.lock')),error=>error.code==='ENOENT');}finally{release?.();await f.close();}
});
test('same-process HMR replaces ownership; old close callback cannot delete a newer owner',async()=>{
 const f=await fixture();let old,newer;try{old=acquireDataLease(f.root);newer=acquireDataLease(f.root,{allowSameProcess:true});old();assert.equal((await json(join(f.root,'runtime.lock'))).token,newer.owner.token);assert.equal((await json(join(f.root+'.lease','owner.json'))).token,newer.owner.token);assert.throws(()=>acquireDataLease(f.root),/phiên khác/);}finally{newer?.();old?.();await f.close();}
});
test('verified different PID generation is reclaimed and retained as a nonempty stale packet',async()=>{
 const f=await fixture(),owner=staleOwner();let release;try{await seed(f.root,owner);release=acquireDataLease(f.root);assert.notEqual(release.owner.token,owner.token);assert.deepEqual(await json(join(f.root+'.lease-stale-'+owner.token,'owner.json')),owner);}finally{release?.();await f.close();}
});
test('legacy live PID, unreadable generation and corrupt metadata preserve existing locks',async()=>{
 const f=await fixture();try{
  const legacy={pid:process.pid,token:randomUUID()};await seed(f.root,legacy,{packet:false});assert.throws(()=>acquireDataLease(f.root),/phiên khác/);assert.deepEqual(await json(join(f.root,'runtime.lock')),legacy);
  assert.throws(()=>acquireDataLease(f.root,{inspectProcess:pid=>({state:'unknown',pid})}),/Chưa xác minh/);assert.deepEqual(await json(join(f.root,'runtime.lock')),legacy);
  await writeFile(join(f.root,'runtime.lock'),'invalid');assert.throws(()=>acquireDataLease(f.root),/Không đọc/);assert.equal(await readFile(join(f.root,'runtime.lock'),'utf8'),'invalid');
 }finally{await f.close();}
});
test('a canonical packet with missing metadata is not overwritten as an empty directory',async()=>{
 const f=await fixture();try{await mkdir(f.root+'.lease');assert.throws(()=>acquireDataLease(f.root),/Không đọc/);await access(f.root+'.lease');await assert.rejects(access(join(f.root,'runtime.lock')),error=>error.code==='ENOENT');}finally{await f.close();}
});
test('a junction/symlink alias cannot obtain a second lease for the same physical data',async()=>{
 const f=await fixture(),alias=join(f.folder,'alias');let release;try{
  await mkdir(f.root);await symlink(f.root,alias,process.platform==='win32'?'junction':'dir');release=acquireDataLease(alias);assert.equal(release.dataDirectory,f.root);
  assert.throws(()=>acquireDataLease(f.root),/phiên khác/);assert.throws(()=>acquireDataLease(alias),/phiên khác/);assert.equal((await json(join(f.root,'runtime.lock'))).token,release.owner.token);
 }finally{release?.();await f.close();}
});
async function contender(root){const child=fork(resolve(import.meta.dirname,'test-fixtures/lease-process.mjs'),[root],{windowsHide:true,stdio:['ignore','ignore','ignore','ipc']});await once(child,'message');return child;}
test('a real crashed owner leaves evidence and is reclaimed after OS confirms its exit',async()=>{
 const f=await fixture();let child,release;try{
  child=await contender(f.root);const reply=once(child,'message');child.send('acquire');const [acquired]=await reply;assert.equal(acquired.type,'acquired');assert.throws(()=>acquireDataLease(f.root),/phiên khác/);
  const exited=once(child,'exit');child.kill();await exited;assert.equal((await json(join(f.root+'.lease','owner.json'))).token,acquired.owner.token);
  release=acquireDataLease(f.root);assert.notEqual(release.owner.token,acquired.owner.token);assert.deepEqual(await json(join(f.root+'.lease-stale-'+acquired.owner.token,'owner.json')),acquired.owner);
 }finally{release?.();if(child&&child.exitCode===null&&child.signalCode===null){child.kill();await once(child,'exit');}await f.close();}
});
for(const preexisting of [false,true])test('three simultaneous processes keep exactly one owner '+(preexisting?'when reclaiming the same stale packet':'on fresh data'),{timeout:35000},async()=>{
 const f=await fixture(),children=[];try{
  if(preexisting)await seed(f.root,staleOwner());children.push(...await Promise.all([contender(f.root),contender(f.root),contender(f.root)]));
  const replies=children.map(child=>once(child,'message'));for(const child of children)child.send('acquire');const results=(await Promise.all(replies)).map(([reply])=>reply),winners=results.filter(reply=>reply.type==='acquired');assert.equal(winners.length,1,JSON.stringify(results));
  const owner=await json(join(f.root+'.lease','owner.json'));assert.equal(owner.token,winners[0].owner.token);assert.equal((await json(join(f.root,'runtime.lock'))).token,owner.token);
  const exits=children.map(child=>once(child,'exit'));for(const child of children)child.send('release');await Promise.all(exits);await assert.rejects(access(f.root+'.lease'),error=>error.code==='ENOENT');
 }finally{for(const child of children)if(child.exitCode===null&&child.signalCode===null){child.kill();await once(child,'exit');}await f.close();}
});
