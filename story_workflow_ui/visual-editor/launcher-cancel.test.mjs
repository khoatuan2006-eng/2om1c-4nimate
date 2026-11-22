import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {mkdtemp,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {removeTestFolder} from './test-runtime.mjs';
test('cancelling the actual launcher during build stops its child and never opens a runtime or database',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'doyin-editor-test-')),reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(ok=>reservation.close(ok));
 let buildPid,child,logs='',ready=false;
 try{
  child=fork(resolve(import.meta.dirname,'launch-editor.mjs'),[],{windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],env:{...process.env,EDITOR_DATA_DIR:join(folder,'data'),EDITOR_PORT:String(port),EDITOR_SKIP_LEGACY_MIGRATION:'1',EDITOR_NO_BROWSER:'1'}});
  child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);
  child.on('message',message=>{if(message.type==='building'){buildPid=message.pid;child.send('shutdown');}if(message.type==='ready')ready=true;});
  const timeout=setTimeout(()=>child.kill(),15000);try{await once(child,'exit');}finally{clearTimeout(timeout);}
  assert.ok(buildPid,logs);assert.equal(child.exitCode,0,logs);assert.equal(ready,false);assert.match(logs,/Đã hủy/);
  assert.throws(()=>process.kill(buildPid,0),error=>error.code==='ESRCH');await assert.rejects(access(join(folder,'data/projects.sqlite')),error=>error.code==='ENOENT');await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(1000)}));
 }finally{if(child&&child.exitCode===null&&child.signalCode===null){child.kill();await once(child,'exit');}await removeTestFolder(folder);}
});
