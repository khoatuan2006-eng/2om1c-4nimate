import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readProcessIdentity,readProcessIdentitySync} from './process-identity.mjs';
test('OS process generation is stable while alive and disappears after an owned child exits',async()=>{
 const self=await readProcessIdentity(process.pid);assert.equal(self.state,'alive');assert.ok(self.birth);assert.deepEqual(await readProcessIdentity(process.pid),self);
 assert.deepEqual(readProcessIdentitySync(process.pid),self);
 assert.equal((await readProcessIdentity(-1)).state,'gone');assert.equal((await readProcessIdentity('1;exit')).state,'gone');
 const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});await once(child,'spawn');
 try{const identity=await readProcessIdentity(child.pid);assert.equal(identity.state,'alive');assert.notEqual(identity.birth,self.birth);child.kill();await once(child,'exit');assert.equal((await readProcessIdentity(child.pid)).state,'gone');}
 finally{if(child.exitCode===null&&child.signalCode===null){child.kill();await once(child,'exit');}}
});
