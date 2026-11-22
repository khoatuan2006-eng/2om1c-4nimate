import {audioReference} from './audio-reference.mjs';
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,readdir,readFile,copyFile,rename,stat,lstat,realpath,unlink} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {SCHEMA_VERSION} from './project-store.mjs';
import {validateDocument} from './model.mjs';
import {atomicWriteJson,renameWithRetry} from './atomic-write.mjs';
import {acquireDataLease} from './data-lease.mjs';
import {assertExportsStopped} from './export-restore-guard.mjs';
const valid=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
const child=(root,path)=>{if(typeof path!=='string'||path.includes('\\')||path.split('/').some(part=>!part||part==='..'||part.startsWith('.')))throw Error('Đường dẫn bản sao lưu không hợp lệ.');const file=resolve(root,path),rel=relative(resolve(root),file);if(isAbsolute(rel)||rel.startsWith('..'))throw Error('Bản sao lưu trỏ ra ngoài thư mục.');return file;};
export async function fileHash(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
export function inspectDatabase(file){
 const db=new DatabaseSync(file,{readOnly:true});try{
  const version=db.prepare('PRAGMA user_version').get().user_version;if(version>SCHEMA_VERSION)throw Error('Bản sao lưu cần phiên bản editor mới hơn.');
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Database không vượt qua kiểm tra toàn vẹn.');
  const scenes=db.prepare('SELECT * FROM scenes').all(),projects=db.prepare('SELECT * FROM projects').all();
  const requiredMedia=new Set();
  for(const scene of scenes){const source=JSON.parse(scene.source),doc=JSON.parse(scene.document);if(!Number.isSafeInteger(source.duration)||source.duration<1||source.id!==scene.id||doc.revision!==scene.revision)throw Error('Scene trong bản sao lưu không hợp lệ.');validateDocument(doc,source.duration);for(const layer of Object.values(doc.layers))for(const part of layer.asset?.parts??[])requiredMedia.add('media/'+part.src);for(const cue of source.cues??[]){if(source.kind==='authored'&&cue.publicPath==null&&cue.contentHash==null)continue;const {path}=audioReference(cue);requiredMedia.add('media/'+path);}}
  for(const project of projects){const order=JSON.parse(project.scene_order),members=scenes.filter(s=>s.project_id===project.id).map(s=>s.id),locked=JSON.parse(project.locked_prefix);if(!Array.isArray(order)||order.length!==members.length||new Set(order).size!==order.length||order.some(id=>!members.includes(id))||!Array.isArray(locked)||locked.some((id,index)=>order[index]!==id))throw Error('Thứ tự scene trong bản sao lưu không hợp lệ.');}
  return {schemaVersion:version,projects:projects.length,scenes:scenes.length,integrity:'ok',requiredMedia:[...requiredMedia]};
 }finally{db.close();}
}
async function copyRecorded(source,target,relativePath,records){
 await mkdir(dirname(target),{recursive:true});
 for(let attempt=0;attempt<3;attempt++){
  const before=await fileHash(source);await copyFile(source,target);const copied=await fileHash(target),after=await fileHash(source);
  if(before===copied&&before===after){records.push({path:relativePath,sha256:copied,bytes:(await stat(target)).size});return;}
 }
 throw Error('Tài nguyên thay đổi trong lúc sao lưu: '+relativePath);
}
async function copyTree(source,target,prefix,records){
 let entries;try{entries=await readdir(source,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return;throw error;}
 for(const entry of entries){if(entry.name.startsWith('.')||entry.name.endsWith('.tmp'))continue;const src=resolve(source,entry.name),dest=resolve(target,entry.name),path=prefix+'/'+entry.name;if(entry.isSymbolicLink())throw Error('Không sao lưu tài nguyên qua symbolic link.');if(entry.isDirectory())await copyTree(src,dest,path,records);else await copyRecorded(src,dest,path,records);}
}
export async function verifyBackup(folder){
 const manifest=JSON.parse(await readFile(resolve(folder,'manifest.json'),'utf8'));
 if(manifest.version!==1||manifest.status!=='complete'||!valid(manifest.id)||!Array.isArray(manifest.files))throw Error('Bản sao lưu chưa hoàn tất hoặc không được hỗ trợ.');
 const canonicalRoot=await realpath(folder),paths=new Set();for(const record of manifest.files){if(paths.has(record.path)||!['projects.sqlite'].includes(record.path)&&!record.path.startsWith('media/')&&!record.path.startsWith('jobs/'))throw Error('Danh mục bản sao lưu không hợp lệ.');paths.add(record.path);const file=child(folder,record.path),info=await lstat(file),canonical=await realpath(file),rel=relative(canonicalRoot,canonical);if(isAbsolute(rel)||rel.startsWith('..')||!info.isFile()||info.isSymbolicLink()||info.size!==record.bytes||await fileHash(file)!==record.sha256)throw Error('Bản sao lưu sai hash hoặc thiếu tài nguyên: '+record.path);}
 if(!paths.has('projects.sqlite'))throw Error('Bản sao lưu thiếu database.');
 const database=inspectDatabase(resolve(folder,'projects.sqlite'));for(const path of database.requiredMedia)if(!paths.has(path))throw Error('Bản sao lưu thiếu tài nguyên đang dùng: '+path);return {...manifest,database};
}
export async function createBackup(store,dataDirectory){
 const root=resolve(dataDirectory,'backups'),id=randomUUID(),stage=resolve(root,'.pending-'+id),folder=resolve(root,id),records=[];
 await mkdir(stage,{recursive:true});
 try{
  const databasePath=resolve(stage,'projects.sqlite');await backup(store.db,databasePath);
  // A backup must be independently readable without a companion WAL file.
  const copy=new DatabaseSync(databasePath);try{copy.exec('PRAGMA journal_mode=DELETE');}finally{copy.close();}
  records.push({path:'projects.sqlite',bytes:(await stat(databasePath)).size,sha256:await fileHash(databasePath)});
  await copyTree(resolve(dataDirectory,'jobs'),resolve(stage,'jobs'),'jobs',records);
  await copyTree(resolve(dataDirectory,'media'),resolve(stage,'media'),'media',records);
  const manifest={version:1,id,status:'complete',createdAt:new Date().toISOString(),database:inspectDatabase(databasePath),files:records,totalBytes:records.reduce((n,file)=>n+file.bytes,0),excluded:['derived exports','external PSD/extracted source library']};
  await atomicWriteJson(resolve(stage,'manifest.json'),manifest);await verifyBackup(stage);await rename(stage,folder);return {id,folder,...manifest};
 }catch(error){await atomicWriteJson(resolve(stage,'failure.json'),{status:'failed',at:new Date().toISOString(),error:error.message}).catch(()=>{});throw error;}
}
export async function listBackups(dataDirectory){
 const root=resolve(dataDirectory,'backups');let names;try{names=await readdir(root);}catch(error){if(error.code==='ENOENT')return [];throw error;}
 const results=await Promise.all(names.filter(valid).map(async id=>{try{const data=JSON.parse(await readFile(resolve(root,id,'manifest.json'),'utf8'));return {id,createdAt:data.createdAt,status:data.status,totalBytes:data.totalBytes,projects:data.database.projects,scenes:data.database.scenes};}catch{return null;}}));return results.filter(Boolean).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
export async function restoreBackup(folder,dataDirectory,{renameOperation=renameWithRetry}={}){
 const release=acquireDataLease(dataDirectory),target=release.dataDirectory,id=randomUUID(),stage=target+'.restore-'+id,rollback=target+'.rollback-'+id;
 const journal=target+'.restore-journal.json';let moved=false,committed=false,journalWritten=false;
 try{
  await assertExportsStopped(target);
  const manifest=await verifyBackup(folder);await mkdir(stage);
  for(const record of manifest.files)await copyRecorded(child(folder,record.path),child(stage,record.path),record.path,[]);
  inspectDatabase(resolve(stage,'projects.sqlite'));
  await atomicWriteJson(stage+'/restore-receipt.json',{restoreId:id,backupId:manifest.id,at:new Date().toISOString(),rollback,files:manifest.files.length});
  await atomicWriteJson(journal,{version:1,id,pid:process.pid,birth:release.owner.birth,target,stage,rollback,backupId:manifest.id});journalWritten=true;
  await renameOperation(target,rollback);moved=true;await renameOperation(stage,target);committed=true;
  await unlink(journal);journalWritten=false;
  return {backupId:manifest.id,dataDirectory:target,rollback,files:manifest.files.length};
 }catch(error){if(moved&&!committed){try{await renameWithRetry(rollback,target);}catch(rollbackError){throw new AggregateError([error,rollbackError],'Phục hồi bị gián đoạn; giữ nguyên thư mục rollback để khôi phục.');}}if(journalWritten&&!committed)await unlink(journal).catch(()=>{});throw error;}
 finally{release();}
}
