import {readFile,readdir,mkdir,open,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareLibraryImage,readLibraryImage} from './prepared-media.mjs';
import {atomicWriteJson} from './atomic-write.mjs';
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function registerSupplement(input,mediaRoot){
 if(input.version!==1||!input.name?.trim()||!['characters','backgrounds','props'].includes(input.type)||!['generated','stock-composite','derived','unknown'].includes(input.provenance?.kind)||!['candidate','rejected','reviewed'].includes(input.review?.status))throw Error('Hồ sơ tài nguyên không hợp lệ');
 if(!Array.isArray(input.tags)||!Array.isArray(input.capabilities)||!Array.isArray(input.limitations)||!input.purpose||!input.projectId)throw Error('Thiếu mục đích/phạm vi/giới hạn');
 const bytes=await readLibraryImage(input.sourceFile,input.sha256),sha256=input.sha256;
 const root=resolve(mediaRoot,'supplemental'),directory=join(root,'records');await mkdir(directory,{recursive:true});
 const lock=join(root,'.write.lock'),handle=await open(lock,'wx').catch(()=>{throw Error('Catalog đang được ghi. Kiểm tra tiến trình ghi trước khi thử lại.');});
 try{
  const file=join(directory,sha256+'.json');let previous;try{previous=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const {expectedRevision,...payload}=input,contentHash=digest(JSON.stringify(payload));
  if(previous?.contentHash===contentHash&&previous.recordHash){const {recordHash,...data}=previous;if(digest(JSON.stringify(data))!==recordHash)throw Error('Catalog record changed outside registry');return previous;}
  if(previous&&previous.contentHash!==contentHash&&expectedRevision!==previous.revision)throw Error('Catalog revision conflict');
  const provenance=structuredClone(input.provenance),review=structuredClone(input.review);provenance.integrityIssues=[];
  // Copy provenance documents into the same media tree included by editor backups.
  for(const ref of [...(provenance.references??[]),...(provenance.documents??[]),...(review.evidence??[])]){
   try{const data=await readFile(ref.path),actual=digest(data);if(ref.sha256&&ref.sha256!==actual){provenance.integrityIssues.push('Changed reference: '+ref.path);continue;}ref.sha256=actual;ref.archivedPath='supplemental/provenance/'+actual+'.bin';await import('./atomic-write.mjs').then(m=>m.atomicWriteBytes(resolve(mediaRoot,ref.archivedPath),data));}catch(e){provenance.integrityIssues.push('Missing reference: '+ref.path);}
  }
  if(provenance.kind==='generated'&&(!provenance.prompt?.text||!provenance.tool||!provenance.documents?.length))provenance.integrityIssues.push('Missing generated-image prompt/tool/source documents');
  if(provenance.prompt?.text)provenance.prompt.sha256=digest(provenance.prompt.text);
  if(input.review.status==='reviewed'&&(!input.review.evidence?.length||provenance.integrityIssues.length))throw Error('Không thể đánh dấu reviewed khi thiếu bằng chứng hoặc nguồn đã thay đổi');
  const {src}=await prepareLibraryImage(input.sourceFile,sha256,mediaRoot);
  const record={...payload,review,provenance,id:'supplemental-'+sha256,revision:(previous?.revision??0)+1,contentHash,image:{src,sha256,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)},registeredAt:new Date().toISOString()};
  if(previous)await atomicWriteJson(join(root,'history',sha256+'-'+previous.revision+'.json'),previous);
  record.recordHash=digest(JSON.stringify(record));await atomicWriteJson(file,record);return record;
 }finally{await handle.close();await unlink(lock);}
}
export async function supplementalCatalog(mediaRoot,registerFile=()=>{}){
 const dir=resolve(mediaRoot,'supplemental/records');let names;try{names=await readdir(dir);}catch(e){if(e.code==='ENOENT')return [];throw e;}
 const result=[];
 for(const name of names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).sort()){
  try{
  const record=JSON.parse(await readFile(join(dir,name),'utf8'));
  const {recordHash,...data}=record;if(!recordHash||digest(JSON.stringify(data))!==recordHash)throw Error('Catalog metadata hash mismatch');
  if(record.review.status==='rejected')continue;
  const {src,sha256,width,height}=record.image;if(src!=='library-assets/'+sha256+'.png'||name!==sha256+'.json')throw Error('Catalog image path mismatch');await readLibraryImage(resolve(mediaRoot,src),sha256);registerFile(sha256,resolve(mediaRoot,src));
  const item={id:sha256,name:record.name,bbox:[0,0,width,height],width,height,url:'/api/library/image?id='+sha256};
  result.push({id:record.id,name:record.name+(record.review.status==='candidate'?' · Chưa duyệt':''),type:record.type,collection:'supplemental',canvas:[width,height],groups:{[record.type==='characters'?'poses':record.type==='props'?'props':'layers']:[item]},aliases:record.tags,tags:record.tags,capabilities:record.capabilities,limitations:record.limitations,review:record.review,provenance:record.provenance,projectId:record.projectId,identity:record.identity,revision:record.revision});
  }catch(e){result.push({id:'supplemental-unavailable-'+name,name:'Tài nguyên bổ sung không khả dụng · '+name.slice(0,10),type:'props',collection:'supplemental',canvas:[1,1],groups:{props:[]},review:{status:'unavailable'},limitations:[e.message],provenance:{kind:'unknown',integrityIssues:[e.message]}});}
 }return result;
}
