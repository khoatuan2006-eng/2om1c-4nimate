import {resolve} from 'node:path';
import {dataRoot,getProjectStore} from './project-store.mjs';
import {createBackup,listBackups,verifyBackup} from './backup-service.mjs';
import {isLocalWrite} from './http-policy.mjs';
const key=Symbol.for('doyin.editor.backup-operations');
export class BackupOperations{
 constructor(){this.active=null;this.running=null;this.closing=false;}
 run(kind,task){
  if(this.closing)throw Object.assign(Error('Editor đang dừng. Mở lại trước khi sao lưu.'),{status:503});
  if(this.running)throw Object.assign(Error('Đang xử lý một bản sao lưu. Chờ hoàn tất rồi thử lại.'),{status:409});
  this.active={kind,startedAt:new Date().toISOString()};
  const operation=Promise.resolve().then(task);this.running=operation;
  operation.finally(()=>{if(this.running===operation){this.running=null;this.active=null;}}).catch(()=>{});
  return operation;
 }
 async shutdown(){this.closing=true;await this.running?.catch(()=>{});}
}
export function getBackupOperations(){if(!globalThis[key]||globalThis[key].closing)globalThis[key]=new BackupOperations();return globalThis[key];}
const summary=manifest=>({id:manifest.id,createdAt:manifest.createdAt,status:'verified',files:manifest.files.length,totalBytes:manifest.totalBytes,projects:manifest.database.projects,scenes:manifest.database.scenes,schemaVersion:manifest.database.schemaVersion});
export function backupPlugin(){return {name:'editor-backups',configureServer(server){
 const store=getProjectStore(),operations=getBackupOperations();
 server.middlewares.use(async(req,res,next)=>{
  const url=new URL(req.url,'http://localhost');if(url.pathname!=='/api/backups'&&!url.pathname.startsWith('/api/backups/'))return next();
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  try{
   if(req.method!=='GET'&&!isLocalWrite(req))return send(403,{error:'Origin không hợp lệ'});
   if(url.pathname==='/api/backups'){
    if(req.method==='GET')return send(200,{backups:await listBackups(dataRoot),active:operations.active});
    if(req.method==='POST')return send(201,summary(await operations.run('create',()=>createBackup(store,dataRoot))));
   }
   const match=/^\/api\/backups\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/verify$/.exec(url.pathname);
   if(match&&req.method==='POST')return send(200,summary(await operations.run('verify',()=>verifyBackup(resolve(dataRoot,'backups',match[1])))));
   return send(404,{error:'Không tìm thấy thao tác sao lưu.'});
  }catch(error){send(error.status??(error.code==='ENOENT'?404:400),{error:error.message});}
 });
}};}
