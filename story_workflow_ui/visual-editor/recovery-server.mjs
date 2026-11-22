import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';
import {listBackups,verifyBackup,restoreBackup} from './backup-service.mjs';
import {isLocalHost,isLocalWrite,jsonResponse} from './http-policy.mjs';
import {atomicWriteJson} from './atomic-write.mjs';
import {acquireDataLease,canonicalDataDirectory} from './data-lease.mjs';
const valid=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
const signature=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function createRecoveryServer({dataDirectory=process.env.EDITOR_DATA_DIR??resolve(import.meta.dirname,'data'),verify=verifyBackup}={}){
 const root=canonicalDataDirectory(dataDirectory),journal=root+'.recovery-job.json',plans=new Map(),readers=new Set(),release=acquireDataLease(root+'.recovery-control');let job=null,task=null,closing=false,lastBackups=[];
 const readSafely=operation=>{const pending=Promise.resolve().then(operation);readers.add(pending);return pending.finally(()=>readers.delete(pending));};
 try{job=JSON.parse(await readFile(journal,'utf8'));if(job.status==='running'){job={...job,status:'interrupted',error:'Phiên phục hồi bị gián đoạn. Giữ thư mục rollback, kiểm tra dữ liệu trước khi thử lại.'};await atomicWriteJson(journal,job);}}catch(error){if(error.code!=='ENOENT'){release();throw error;}}
 const server=createServer(async(req,res)=>{
  if(!isLocalHost(req))return jsonResponse(res,403,{error:'Chỉ chấp nhận địa chỉ máy cục bộ.'});
  if(closing)return jsonResponse(res,503,{error:'Công cụ phục hồi đang dừng.'});
  res.setHeader('X-Content-Type-Options','nosniff');const url=new URL(req.url,'http://localhost');
  try{
   if(url.pathname.startsWith('/api/')){
    if(req.method!=='GET'&&!isLocalWrite(req))return jsonResponse(res,403,{error:'Origin không hợp lệ.'});
    const body=async()=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw Error('Yêu cầu quá lớn.');}return JSON.parse(raw||'{}');};
    if(url.pathname==='/api/recovery'&&req.method==='GET'){if(!task)lastBackups=await readSafely(()=>listBackups(root));return jsonResponse(res,200,{backups:lastBackups,job});}
    if(url.pathname==='/api/recovery/verify'&&req.method==='POST'){
     if(task)return jsonResponse(res,409,{error:'Đang phục hồi; chờ hoàn tất.'});const {id}=await body();if(!valid(id))throw Error('Mã bản sao không hợp lệ.');
     if(task||closing)return jsonResponse(res,409,{error:'Đang phục hồi hoặc dừng công cụ. Chờ hoàn tất.'});const manifest=await readSafely(()=>verify(resolve(root,'backups',id)));if(task||closing)return jsonResponse(res,409,{error:'Đang phục hồi hoặc dừng công cụ. Chờ hoàn tất.'});const ticket=randomUUID();plans.clear();plans.set(ticket,{id,signature:signature(manifest),expires:Date.now()+600000});
     return jsonResponse(res,200,{ticket,id,createdAt:manifest.createdAt,projects:manifest.database.projects,scenes:manifest.database.scenes,files:manifest.files.length,totalBytes:manifest.totalBytes});
    }
    if(url.pathname==='/api/recovery/restore'&&req.method==='POST'){
     const input=await body();if(input.ticket===job?.id)return jsonResponse(res,200,job);
     if(task)return jsonResponse(res,409,{error:'Đang phục hồi một bản sao. Chờ hoàn tất.'});
     const plan=plans.get(input.ticket);if(!plan||Date.now()>plan.expires||input.confirm!==true)throw Error('Kiểm tra lại bản sao và xác nhận trước khi phục hồi.');
     const folder=resolve(root,'backups',plan.id),manifest=await readSafely(()=>verify(folder));if(signature(manifest)!==plan.signature)throw Error('Bản sao đã thay đổi sau kiểm tra. Kiểm tra lại trước khi phục hồi.');
     if(closing)return jsonResponse(res,503,{error:'Công cụ phục hồi đang dừng.'});if(input.ticket===job?.id)return jsonResponse(res,200,job);if(task)return jsonResponse(res,409,{error:'Đang phục hồi một bản sao. Chờ hoàn tất.'});
     // Reserve synchronously, then persist before any swap. Retries with the
     // same ticket return the recorded outcome instead of restoring twice.
     job={id:input.ticket,backupId:plan.id,status:'running',startedAt:new Date().toISOString()};plans.delete(input.ticket);
     task=(async()=>{await atomicWriteJson(journal,job);await Promise.allSettled([...readers]);let outcome;try{const result=await restoreBackup(folder,root);lastBackups=[];outcome={...job,status:'complete',completedAt:new Date().toISOString(),rollback:result.rollback,files:result.files};}catch(error){outcome={...job,status:'failed',error:error.message,completedAt:new Date().toISOString()};}await atomicWriteJson(journal,outcome);job=outcome;})().catch(error=>{job={...job,status:'interrupted',error:'Chưa ghi được kết quả phục hồi: '+error.message};}).finally(()=>{task=null;});
     return jsonResponse(res,202,job);
    }
    return jsonResponse(res,404,{error:'Không tìm thấy thao tác.'});
   }
   const files={'/':'recovery.html','/recovery.js':'recovery.js','/recovery.css':'recovery.css'},file=files[url.pathname];
   if(!file||req.method!=='GET')return jsonResponse(res,404,{error:'Không tìm thấy trang.'});
   res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; frame-ancestors 'none'"});res.end(await readFile(resolve(import.meta.dirname,file)));
  }catch(error){jsonResponse(res,error.code==='ENOENT'?404:400,{error:error.message});}
 });
 return {server,async listen(port=3024){await new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',fail);ok();});});return server.address();},async close(){closing=true;if(server.listening)await new Promise(ok=>{server.close(ok);server.closeIdleConnections();});await task;release();}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 let app;
 try{const port=Number(process.env.EDITOR_RECOVERY_PORT??3024);if(!Number.isInteger(port)||port<0||port>65535)throw Error('Cổng phục hồi không hợp lệ.');app=await createRecoveryServer();const address=await app.listen(port);console.log('Phục hồi dữ liệu: http://127.0.0.1:'+address.port);if(process.send)process.send({type:'ready',port:address.port});let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;await app.close();if(process.connected)process.disconnect();};process.on('SIGINT',stop);process.on('SIGTERM',stop);process.on('message',message=>{if(message==='shutdown')stop();});}catch(error){await app?.close();console.error(error.message);process.exitCode=1;}
}
