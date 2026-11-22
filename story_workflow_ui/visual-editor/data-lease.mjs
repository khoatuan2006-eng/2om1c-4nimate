import {mkdirSync,readFileSync,unlinkSync,rmdirSync,existsSync,renameSync,realpathSync,lstatSync,readlinkSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {resolve,dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
import {recoverInterruptedRestore} from './restore-journal.mjs';
import {readProcessIdentitySync,validProcessBirth} from './process-identity.mjs';
import {atomicWriteJsonSync,renameSyncWithRetry} from './atomic-write.mjs';
const validToken=token=>typeof token==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(token);
const readOwner=file=>{let owner;try{owner=JSON.parse(readFileSync(file,'utf8'));}catch{throw Error('Không đọc được khóa dữ liệu. Giữ nguyên khóa để kiểm tra trước khi mở lại.');}if(!Number.isSafeInteger(owner.pid)||owner.pid<=0||!validToken(owner.token))throw Error('Khóa dữ liệu không hợp lệ. Giữ nguyên khóa để kiểm tra.');return owner;};
function mayReplace(owner,{allowSameProcess,inspectProcess}){
 const current=inspectProcess(owner.pid);
 if(current.state==='gone')return true;
 if(current.state==='alive'&&validProcessBirth(owner.birth)&&validProcessBirth(current.birth)&&owner.birth!==current.birth)return true;
 if(allowSameProcess&&owner.pid===process.pid&&current.state==='alive'&&(!owner.birth||owner.birth===current.birth))return true;
 if(current.state==='unknown')throw Error('Chưa xác minh được danh tính phiên đang giữ khóa. Giữ nguyên dữ liệu và chờ phiên đó dừng.');
 throw Error('Dữ liệu editor đang được một phiên khác sử dụng. Đóng phiên đó trước khi mở lại.');
}
function removePacket(folder,token){
 if(!existsSync(folder))return;if(readOwner(resolve(folder,'owner.json')).token!==token)throw Error('Gói khóa đã thay đổi; không dọn khóa của phiên khác.');
 unlinkSync(resolve(folder,'owner.json'));rmdirSync(folder);
}
export function canonicalDataDirectory(dataDirectory){
 let root=resolve(dataDirectory);mkdirSync(dirname(root),{recursive:true});
 for(let attempt=0;attempt<8;attempt++){
  if(existsSync(root))return realpathSync.native(root);
  try{if(lstatSync(root).isSymbolicLink()){root=resolve(dirname(root),readlinkSync(root));continue;}}catch(error){if(error.code!=='ENOENT')throw error;}
  return resolve(realpathSync.native(dirname(root)),basename(root));
 }
 throw Error('Không xác định được thư mục dữ liệu thật. Giữ nguyên đường dẫn để kiểm tra.');
}
export function acquireDataLease(dataDirectory,{allowSameProcess=false,inspectProcess=readProcessIdentitySync}={}){
 const root=canonicalDataDirectory(dataDirectory),identity=readProcessIdentitySync(process.pid);
 if(identity.state!=='alive'||!validProcessBirth(identity.birth))throw Error('Không đọc được thời điểm khởi động editor. Kiểm tra quyền đọc tiến trình trước khi mở dữ liệu.');
 const owner={pid:process.pid,token:randomUUID(),birth:identity.birth,startedAt:new Date().toISOString()},canonical=root+'.lease',stage=root+'.lease-pending-'+owner.token,file=resolve(root,'runtime.lock');
 mkdirSync(dirname(root),{recursive:true});mkdirSync(stage);let claimed=false;
 const release=()=>{
  if(!claimed)return;
  const current=readOwner(resolve(canonical,'owner.json'));if(current.token!==owner.token){claimed=false;return;}
  if(existsSync(file)&&readOwner(file).token===owner.token)unlinkSync(file);
  const retired=root+'.lease-released-'+owner.token;renameSyncWithRetry(canonical,retired);claimed=false;removePacket(retired,owner.token);
 };
 try{
  atomicWriteJsonSync(resolve(stage,'owner.json'),owner);
  for(let attempt=0;;attempt++){
   if(attempt>=8)throw Error('Khóa dữ liệu đang thay đổi. Chờ phiên mở khác hoàn tất rồi thử lại.');
   if(existsSync(canonical)){
    const previous=readOwner(resolve(canonical,'owner.json'));mayReplace(previous,{allowSameProcess,inspectProcess});
    // All contenders use the same nonempty destination for the observed token.
    // A second rename cannot replace that directory or move a new owner into it.
    const retired=root+'.lease-stale-'+previous.token;
    try{if(existsSync(retired))renameSync(canonical,retired);else renameSyncWithRetry(canonical,retired);}catch(failure){if(!['ENOENT','EEXIST','ENOTEMPTY','EPERM','EACCES'].includes(failure.code))throw failure;}
    continue;
   }
   try{renameSync(stage,canonical);claimed=true;break;}catch(error){if(existsSync(canonical))continue;throw error;}
  }
  if(existsSync(file)){const previous=readOwner(file);mayReplace(previous,{allowSameProcess,inspectProcess});unlinkSync(file);}
  recoverInterruptedRestore(root,{inspectProcess});mkdirSync(root,{recursive:true});
  // Legacy runtimes only understand runtime.lock. Never replace a lock they
  // may have created since our initial check, even though new runtimes are
  // already serialized by the canonical directory packet.
  let descriptor;try{descriptor=openSync(file,'wx');writeFileSync(descriptor,JSON.stringify(owner,null,2)+'\n');fsyncSync(descriptor);}catch(error){if(error.code==='EEXIST')throw Error('Khóa dữ liệu vừa được một phiên khác tạo. Chờ phiên đó dừng rồi mở lại editor.');throw error;}finally{if(descriptor!==undefined)closeSync(descriptor);}
  Object.defineProperties(release,{owner:{value:owner},dataDirectory:{value:root}});return release;
 }catch(error){try{release();}catch(cleanup){error.cleanupError=cleanup.message;}try{removePacket(stage,owner.token);}catch{}throw error;}
}
