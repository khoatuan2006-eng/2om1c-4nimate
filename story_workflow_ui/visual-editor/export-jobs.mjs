import {mkdir,readFile,readdir,access} from 'node:fs/promises';
import {openSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {fork,execFile} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {atomicWriteJson} from './atomic-write.mjs';
import {freezeExportMedia} from './export-media.mjs';
import {productionInputsDigest} from './production-inputs.mjs';
import {exportProvenance} from './export-provenance.mjs';
import {setTimeout as delay} from 'node:timers/promises';
import {readProcessIdentity,recordedWorkerState,processAlive as alive} from './process-identity.mjs';

const terminal=new Set(['complete','failed','cancelled']);
const valid=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
const read=path=>readFile(path,'utf8').then(JSON.parse);
const exists=path=>access(path).then(()=>true,()=>false);
async function waitFor(promise,ms){let timer;try{return await Promise.race([promise.then(()=>true),new Promise(ok=>{timer=setTimeout(()=>ok(false),ms);})]);}finally{clearTimeout(timer);}}
async function killOwnedTree(child){
 if(child.exitCode!==null||child.signalCode!==null)return;
 if(process.platform==='win32')await new Promise((ok,fail)=>execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:10000},error=>{if(error&&child.exitCode===null&&child.signalCode===null)fail(error);else ok();}));
 else try{process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')throw error;}
}

export class ExportJobs{
 constructor({root,mediaRoot,workerPath=resolve(import.meta.dirname,'export-worker.mjs'),maxActive=1,inspectProcess=readProcessIdentity}){Object.assign(this,{root,mediaRoot,workerPath,maxActive,inspectProcess});this.workers=new Map();this.preparing=new Set();this.mutations=Promise.resolve();this.closing=false;}
 folder(id){if(!valid(id))throw Error('Mã xuất không hợp lệ.');return resolve(this.root,id);}
 async workerState(job){
  if(this.workers.has(job.id)||this.preparing.has(job.id))return 'alive';
  if(job.status==='preparing'&&job.preparationOwner){const owner=job.preparationOwner,current=await readProcessIdentity(owner.pid);if(current.state==='gone')return 'gone';if(current.state==='alive'&&current.birth)return current.birth===owner.birth?'alive':'gone';return 'unknown';}
  const record=await read(resolve(this.folder(job.id),'worker.json')).catch(()=>null);
  return recordedWorkerState(job,record,this.inspectProcess);
 }
 async get(id){
  const folder=this.folder(id);let job=await read(resolve(folder,'job.json'));
  if(terminal.has(job.status))return job;
  const workerState=await this.workerState(job);
  // The OS query can overlap a worker's final write. Never return the old
  // running status or overwrite a result completed during that query.
  const fresh=await read(resolve(folder,'job.json'));if(terminal.has(fresh.status))return fresh;
  if(fresh.workerPid!==job.workerPid||fresh.workerToken!==job.workerToken)return this.get(id);job=fresh;
  // Identity is evidence to observe, never authorization to kill an unowned process.
  if(workerState!=='gone'){
   return {...job,workerState,...(workerState==='unknown'?{errorCode:'WORKER_IDENTITY_UNKNOWN',error:'Chưa xác minh được danh tính worker của phiên xuất trước. Giữ nguyên dữ liệu; chờ tiến trình kết thúc trước khi xuất lại.'}:{}),...(await exists(resolve(folder,'cancel.request'))?{status:'cancelling'}:{})};
  }
  if(!job.workerPid&&Date.now()-Date.parse(job.updatedAt??job.createdAt)<10000)return job;
  const interrupted={...job,status:'failed',error:'Phiên xuất đã bị gián đoạn. Bản dựng vẫn được giữ; bạn có thể xuất lại.',updatedAt:new Date().toISOString()};
  await atomicWriteJson(resolve(folder,'job.json'),interrupted);return interrupted;
 }
 async list(){await mkdir(this.root,{recursive:true});return (await Promise.all((await readdir(this.root)).filter(valid).map(id=>this.get(id).catch(error=>{if(error.code==='ENOENT')return null;throw error;})))).filter(Boolean);}
 create(project,scale,requestId,{validateProduction}={}){
  const snapshot=structuredClone(project);const operation=this.mutations.catch(()=>{}).then(()=>this.start(snapshot,scale,requestId,validateProduction));this.mutations=operation;return operation;
 }
 async start(project,scale,requestId,validateProduction){
  if(requestId!==undefined&&!valid(requestId))throw Object.assign(Error('Mã yêu cầu xuất không hợp lệ.'),{status:400});
  if(requestId){
   let previous;try{previous=await this.get(requestId);}catch(error){if(error.code!=='ENOENT')throw error;}
   if(previous){if(previous.requestId!==requestId||previous.projectId!==project.id||previous.scale!==scale)throw Object.assign(Error('Mã yêu cầu đã thuộc một lần xuất khác.'),{status:409});return previous;}
  }
  if(this.closing)throw Object.assign(Error('Editor đang dừng. Hãy mở lại rồi xuất video.'),{status:503});
  if(!project.duration)throw Error('Thêm ít nhất một scene trước khi xuất.');
  if(![1,.5].includes(scale))throw Error('Chọn 1080p hoặc 540p.');
  // Replays above are observations of an existing reservation, not new exports.
  const production=validateProduction?await validateProduction(project):null;
  const jobs=await this.list(),active=jobs.filter(job=>!terminal.has(job.status));
  if(active.some(job=>job.projectId===project.id))throw Object.assign(Error('Dự án đang được xuất. Hãy chờ hoặc hủy bản đang chạy.'),{status:409});
  if(active.length>=this.maxActive)throw Object.assign(Error('Máy đang xuất một video. Chờ hoàn tất hoặc hủy trước khi xuất dự án khác.'),{status:429});
  const id=requestId??randomUUID(),folder=this.folder(id);await mkdir(folder,{recursive:true});
  const owner=await readProcessIdentity(process.pid);if(owner.state!=='alive'||!owner.birth)throw Error('Chưa xác minh được phiên editor để chuẩn bị xuất.');
  const provenance=exportProvenance(project);
  let job={id,...(requestId?{requestId}:{}),projectId:project.id,title:project.title,provenance,status:'preparing',progress:0,scale,workerToken:randomUUID(),createdAt:new Date().toISOString(),preparationOwner:{pid:process.pid,birth:owner.birth}};
  // Persist the request reservation before any media copy or worker launch.
  await atomicWriteJson(resolve(folder,'job.json'),job);this.preparing.add(id);
  let child,fd;
  try{
   if(production?.onReserved)await production.onReserved(job);
   const frozenRoot=resolve(folder,'media'),mediaFiles=await freezeExportMedia(project,this.mediaRoot,frozenRoot);
   if(production?.inputsDigest&&productionInputsDigest(project,frozenRoot)!==production.inputsDigest)throw Error('Media or composition changed while preparing export; review again.');
   const snapshot={schemaVersion:1,project,provenance,mediaRoot:frozenRoot,mediaFiles,createdAt:job.createdAt};
   job={...job,status:'queued',snapshotHash:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')};
   await atomicWriteJson(resolve(folder,'snapshot.json'),snapshot);await atomicWriteJson(resolve(folder,'job.json'),job);
   if(this.closing||await exists(resolve(folder,'cancel.request'))){await atomicWriteJson(resolve(folder,'job.json'),{...job,status:'cancelled'});return await this.get(id);}
   // A file descriptor survives parent death; broken stdout pipes cannot crash a render.
   fd=openSync(resolve(folder,'worker.log'),'a');
   child=fork(this.workerPath,[folder],{windowsHide:true,detached:true,stdio:['ignore',fd,fd,'ipc']});
   let finish;const done=new Promise(ok=>finish=ok),entry={child,done};this.workers.set(id,entry);
   let settled=false;
   const settle=async(error)=>{
    if(settled)return;settled=true;
    try{const current=await read(resolve(folder,'job.json'));if(!terminal.has(current.status))await atomicWriteJson(resolve(folder,'job.json'),{...current,status:await exists(resolve(folder,'cancel.request'))?'cancelled':'failed',error:error?.message??'Tiến trình xuất đã dừng trước khi hoàn tất.',updatedAt:new Date().toISOString()});}
    catch(failure){entry.error=failure;}
    finally{this.workers.delete(id);finish();}
   };
   child.once('error',error=>{if(child.pid&&child.exitCode===null&&child.signalCode===null&&alive(child.pid)){entry.error=error;return;}settle(error);});child.once('exit',()=>settle());
   await new Promise((ok,fail)=>{child.once('spawn',ok);child.once('error',fail);});
   const identity=await this.inspectProcess(child.pid);
   if(identity.state!=='alive'||!identity.birth){if(child.exitCode!==null||child.signalCode!==null)return await this.get(id);throw Error('Không xác minh được thời điểm khởi động worker. Bản xuất đã dừng; kiểm tra quyền đọc tiến trình trước khi thử lại.');}
   if(child.exitCode===null&&child.signalCode===null)await atomicWriteJson(resolve(folder,'worker.json'),{pid:child.pid,token:job.workerToken,birth:identity.birth,createdAt:new Date().toISOString()});
   return await this.get(id);
  }catch(error){
   if(child?.pid&&child.exitCode===null&&child.signalCode===null){await this.cancel(id).catch(()=>{});const done=this.workers.get(id)?.done;await killOwnedTree(child);if(done&&!await waitFor(done,5000))throw Error('Không thể xác nhận worker đã dừng sau lỗi khởi tạo.');}
   const current=await read(resolve(folder,'job.json'));if(!terminal.has(current.status))await atomicWriteJson(resolve(folder,'job.json'),{...current,status:'failed',error:error.message,updatedAt:new Date().toISOString()});throw error;
  }finally{this.preparing.delete(id);if(fd!==undefined)closeSync(fd);}
 }
 async cancel(id){
  const job=await this.get(id);if(terminal.has(job.status))return job;
  await atomicWriteJson(resolve(this.folder(id),'cancel.request'),{requestedAt:new Date().toISOString()});
  const child=this.workers.get(id)?.child;if(child?.connected)child.send('cancel',()=>{});
  return {...job,status:'cancelling'};
 }
 shutdown({timeoutMs=5000}={}){
  if(this.shutdownPromise)return this.shutdownPromise;this.closing=true;
  this.shutdownPromise=(async()=>{
   await this.mutations.catch(()=>{});
   const entries=[...this.workers.entries()],active=(await this.list()).filter(job=>!terminal.has(job.status));
   const owned=new Set(entries.map(([id])=>id)),orphans=active.filter(job=>!owned.has(job.id));
   await Promise.all(active.map(job=>this.cancel(job.id)));
   const orphanDeadline=Date.now()+timeoutMs;
   if(!await waitFor(Promise.all(entries.map(([,entry])=>entry.done)),timeoutMs)){
    await Promise.all(entries.map(([,entry])=>killOwnedTree(entry.child)));
    if(!await waitFor(Promise.all(entries.map(([,entry])=>entry.done)),5000))throw Error('Chưa xác nhận tiến trình xuất đã dừng; giữ khóa dữ liệu để tránh chạy chồng.');
   }
   const failure=entries.find(([,entry])=>entry.error)?.[1].error;if(failure)throw failure;
   // A restarted runtime can request cooperative cancellation through disk,
   // but has no child-process handle authorizing a forced kill. Never release
   // its data lease while an unowned worker may still be writing.
   for(const orphan of orphans){
    for(;;){
     const current=await this.get(orphan.id),state=current.workerState??await this.workerState(current);
     if(terminal.has(current.status)&&state==='gone')break;
     if(Date.now()>=orphanDeadline)throw Error('Phiên xuất từ lần mở trước chưa dừng. Giữ khóa dữ liệu; chờ worker kết thúc rồi mở lại editor.');
     await delay(Math.min(50,Math.max(1,orphanDeadline-Date.now())));
    }
   }
  })();return this.shutdownPromise;
 }
}
