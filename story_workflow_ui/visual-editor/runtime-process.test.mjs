import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {once} from 'node:events';
import {removeTestFolder} from './test-runtime.mjs';

function start(folder){
 const child=fork(resolve(import.meta.dirname,'runtime-server.mjs'),[],{windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,EDITOR_DATA_DIR:join(folder,'data'),EDITOR_FRONTEND_DIR:join(folder,'frontend'),EDITOR_SKIP_LEGACY_MIGRATION:'1',EDITOR_PORT:'0'}});
 let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
 const ready=new Promise((ok,fail)=>{
  const timeout=setTimeout(()=>{child.kill();fail(Error('Startup timed out: '+logs));},20000);
  const exited=code=>{clearTimeout(timeout);fail(Error('Runtime exited before ready '+code+': '+logs));};child.once('exit',exited);
  child.on('message',message=>{if(message.type==='ready'){clearTimeout(timeout);child.removeListener('exit',exited);ok('http://127.0.0.1:'+message.port);}});
 });return {child,ready};
}
async function stop(child,graceful){
 if(child.exitCode!==null||child.signalCode!==null)return;
 const exit=once(child,'exit');if(graceful)child.send('shutdown');else child.kill();
 const timeout=setTimeout(()=>child.kill(),10000);try{await exit;}finally{clearTimeout(timeout);}
}
test('project transactions survive abrupt process death; standalone runtime reopens data and shuts down cleanly',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-'));await mkdir(join(folder,'frontend'));await writeFile(join(folder,'frontend','index.html'),'<title>Process fixture</title>');
 let running;
 try{
  running=start(folder);let base=await running.ready;
  const duplicate=start(folder);await assert.rejects(duplicate.ready,/phiên khác/);
  const created=await fetch(base+'/api/projects',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({title:'Survives restart'})}).then(r=>r.json());assert.ok(created.id);
  await stop(running.child,false);
  running=start(folder);base=await running.ready;
  const restored=await fetch(base+'/api/projects/'+created.id).then(r=>r.json());assert.equal(restored.title,'Survives restart');assert.equal(restored.revision,0);
  await stop(running.child,true);assert.equal(running.child.exitCode,0);
 }finally{if(running)await stop(running.child,false);await removeTestFolder(folder);}
});
