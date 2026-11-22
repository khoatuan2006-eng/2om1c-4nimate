import {open,rename,unlink,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {mkdirSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync,unlinkSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
export async function renameWithRetry(from,to,{operation=rename}={}){
 for(let attempt=0;;attempt++){try{return await operation(from,to);}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=8)throw error;await delay(40*(attempt+1));}}
}
export function renameSyncWithRetry(from,to){
 for(let attempt=0;;attempt++){try{return renameSync(from,to);}catch(error){if(!['EPERM','EACCES','EBUSY'].includes(error.code)||attempt>=8)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,40*(attempt+1));}}
}
export async function atomicWriteBytes(file,bytes){
 await mkdir(dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';let handle;
 try{
  handle=await open(temp,'wx');await handle.writeFile(bytes);await handle.sync();await handle.close();handle=null;
  await renameWithRetry(temp,file);
 }catch(error){await handle?.close().catch(()=>{});await unlink(temp).catch(()=>{});throw error;}
}
export async function atomicWriteJson(file,value){return atomicWriteBytes(file,JSON.stringify(value,null,2)+'\n');}
export function atomicWriteJsonSync(file,value){
 mkdirSync(dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';let handle;
 try{
  handle=openSync(temp,'wx');writeFileSync(handle,JSON.stringify(value,null,2)+'\n');fsyncSync(handle);closeSync(handle);handle=undefined;
  renameSyncWithRetry(temp,file);
 }catch(error){if(handle!==undefined)try{closeSync(handle);}catch{}try{unlinkSync(temp);}catch{}throw error;}
}
