import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {atomicWriteJson} from './atomic-write.mjs';
import {storageError} from './storage-error.mjs';
const unknownResult=job=>job.resultPending===true||(job.resultPending===undefined&&job.current>job.cues.length);
const terminal=new Set(['complete','failed','cancelled','interrupted']);
const assertSame=(existing,input)=>{if(existing&&JSON.stringify([existing.projectId,existing.lines,existing.voiceId])!==JSON.stringify([input.projectId,input.lines,input.voiceId]))throw Object.assign(Error('Bản nháp đã có thoại, giọng đọc hoặc dự án khác.'),{status:409});};
export class AudioJobs{
 constructor({root,generate,timing,owner,isOwnerAlive,maxPending=8,persist=atomicWriteJson}){Object.assign(this,{root,generate,timing,owner,isOwnerAlive,maxPending,persist});this.active=new Map();this.writes=new Map();this.errors=new Map();this.queue=Promise.resolve();this.closing=false;this.abandoned=new Set();this.controllers=new Map();}
 path(id){if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw Error('Mã bản nháp không hợp lệ.');return resolve(this.root,id+'.audio.json');}
 read(id){return readFile(this.path(id),'utf8').then(JSON.parse);}
 change(id,mutate){
  const next=(this.writes.get(id)??Promise.resolve()).catch(()=>{}).then(async()=>{let job;try{job=await this.read(id);}catch(error){if(error.code!=='ENOENT')throw error;}job=mutate(job);await this.persist(this.path(id),job);return job;});
  this.writes.set(id,next);next.finally(()=>{if(this.writes.get(id)===next)this.writes.delete(id);}).catch(()=>{});return next;
 }
 async get(id){
  let job=await this.read(id);
  if(this.errors.has(id)){const failure=storageError(this.errors.get(id));return {...job,status:'failed',error:failure?.error??'Không ghi được tiến độ audio. Kiểm tra nơi lưu dữ liệu trước khi thử lại.',errorCode:'JOB_WRITE_FAILED',retryable:!unknownResult(job)};}
  if(!terminal.has(job.status)&&!this.active.has(id)&&!await this.isOwnerAlive(job))job=await this.change(id,current=>({...current,status:'interrupted',error:unknownResult(current)?'Tạo audio bị gián đoạn khi một dòng đang xử lý. Kết quả chưa xác nhận; kiểm tra trước khi gửi lại vì có thể tạo thêm audio.':'Tạo audio bị gián đoạn. Các dòng đã hoàn tất được giữ; kiểm tra rồi tiếp tục các dòng còn lại.',errorCode:'OWNER_STOPPED',retryable:!unknownResult(current)}));
  return job;
 }
 async enqueue(input){
  if(this.closing)throw Object.assign(Error('Máy chủ đang dừng. Hãy mở lại editor trước khi tạo audio.'),{status:503});
  if(this.active.has(input.id)){await this.active.get(input.id).ready;const existing=await this.read(input.id);assertSame(existing,input);return existing;}
  let existing;try{existing=await this.get(input.id);}catch(error){if(error.code!=='ENOENT')throw error;}
  assertSame(existing,input);
  if(this.closing)throw Object.assign(Error('Máy chủ đang dừng. Hãy mở lại editor trước khi tạo audio.'),{status:503});
  if(this.active.has(input.id)){await this.active.get(input.id).ready;const current=await this.read(input.id);assertSame(current,input);return current;}
  if(existing?.status==='complete'||existing&&!terminal.has(existing.status)&&await this.isOwnerAlive(existing))return existing;
  if(this.active.size>=this.maxPending)throw Object.assign(Error('Hàng đợi audio đang đầy. Chờ một đoạn hoàn tất rồi thử lại.'),{status:429});
  // Reserve synchronously, before the first file write, to make duplicate POSTs idempotent.
  let finish;const task=new Promise(ok=>finish=ok);this.active.set(input.id,task);
  try{
   task.ready=this.change(input.id,current=>({...current??input,status:'queued',cancelRequested:false,resultPending:false,retryable:undefined,error:undefined,errorCode:undefined,ownerPid:this.owner.pid,ownerToken:this.owner.token,attempt:(current?.attempt??0)+1,updatedAt:new Date().toISOString()}));const queued=await task.ready;this.errors.delete(input.id);
   this.queue=this.queue.catch(()=>{}).then(()=>this.run(input.id)).finally(()=>{this.active.delete(input.id);finish();});
   this.queue.catch(error=>this.errors.set(input.id,error));return queued;
  }catch(error){this.active.delete(input.id);finish();throw error;}
 }
 async run(id){
  if(this.abandoned.has(id))return;
  try{
   let job=await this.change(id,current=>({...current,status:current.cancelRequested?'cancelling':'running'}));
   for(let index=job.cues.length;index<job.lines.length;index++){
    job=await this.read(id);if(this.abandoned.has(id))return;if(job.cancelRequested)break;
    await this.change(id,current=>({...current,current:index+1,resultPending:true,updatedAt:new Date().toISOString()}));
    const controller=new AbortController();this.controllers.set(id,controller);let audio;
    try{audio=await this.generate({cueId:id+'-'+index,text:job.lines[index],sceneId:'NEW-'+id,voiceId:job.voiceId},{signal:controller.signal});}finally{this.controllers.delete(id);}
    if(this.abandoned.has(id))return;
    await this.change(id,current=>({...current,cues:[...current.cues,audio],resultPending:false,updatedAt:new Date().toISOString()}));
   }
   if(this.abandoned.has(id))return;
   await this.change(id,current=>current.cancelRequested?{...current,status:'cancelled'}:{...current,...this.timing(current.cues),status:'complete',current:current.lines.length});
  }catch(error){if(this.abandoned.has(id))return;await this.change(id,current=>({...current,status:current.cancelRequested?'cancelled':'failed',error:storageError(error)?.error??error.message,errorCode:storageError(error)?.code??error.code??'TTS_FAILED',retryable:error.retryable!==false&&!unknownResult(current),updatedAt:new Date().toISOString()}));}
 }
 async cancel(id){
  const job=await this.get(id);if(terminal.has(job.status))return job;
  return this.change(id,current=>({...current,cancelRequested:true,status:'cancelling',error:'Dừng sau dòng audio đang được xử lý; giữ các dòng đã hoàn tất.'}));
 }
 async drain(){await this.queue.catch(()=>{});}
 shutdown({timeoutMs=5000}={}){
  if(this.shutdownPromise)return this.shutdownPromise;
  this.closing=true;
  this.shutdownPromise=(async()=>{
   const ids=[...this.active.keys()];
   await Promise.all(ids.map(async id=>{
    await this.active.get(id)?.ready;
    await this.change(id,current=>terminal.has(current.status)?current:{...current,cancelRequested:true,status:'cancelling',error:'Editor đang dừng; giữ các dòng đã hoàn tất.'});
   }));
   let timer;const drained=await Promise.race([this.drain().then(()=>true),new Promise(ok=>{timer=setTimeout(()=>ok(false),timeoutMs);})]);clearTimeout(timer);
   if(drained)return {drained:true,interrupted:[]};
   const pending=[...this.active.keys()];
   // Quarantine late provider callbacks before releasing the data lease. Their
   // remote outcome may be unknown; never retry them automatically.
   for(const id of pending){this.abandoned.add(id);this.controllers.get(id)?.abort();}
   await Promise.all(pending.map(id=>this.change(id,current=>terminal.has(current.status)?current:{...current,status:'interrupted',error:'Editor đã dừng khi audio còn xử lý. Kết quả dòng đang gửi có thể chưa xác định; kiểm tra trước khi thử lại.',errorCode:'SHUTDOWN_TIMEOUT',retryable:false,updatedAt:new Date().toISOString()})));
   return {drained:false,interrupted:pending};
  })();
  return this.shutdownPromise;
 }
}
